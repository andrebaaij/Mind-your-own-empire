import "../styles/game.css";
import { playerColor } from "./colors";
import { MAX_TICKS_PER_FRAME, TICK_MS } from "./config";
import { Hud } from "./hud";
import { bindInput, setPaused } from "./input";
import { Renderer } from "./renderer";
import { createGame, tick } from "./state";

const params = new URLSearchParams(window.location.search);

const state = createGame({
  seed: params.get("seed") || "1500",
  player: {
    name: params.get("name") || "Mind",
    color: playerColor(params.get("color")),
  },
});

const game = document.getElementById("game");
if (!game) throw new Error("Missing #game");

const renderer = await Renderer.create(game, state.world);

const hud = new Hud({
  onBuild: (name) => {
    state.building = name;
  },
  onResume: () => setPaused(state, hud, false),
});

const screen = bindInput(renderer, state, hud, game);

// Fixed-timestep simulation, decoupled from the display refresh rate.
let accumulator = 0;
let last = performance.now();
requestAnimationFrame(function frame(now) {
  accumulator = Math.min(accumulator + (now - last), TICK_MS * MAX_TICKS_PER_FRAME);
  last = now;
  while (accumulator >= TICK_MS) {
    tick(state);
    accumulator -= TICK_MS;
  }
  // The camera may have moved, so find the ground under the pointer again.
  state.pointer.world = screen.position ? renderer.groundAt(screen.position) : null;
  renderer.render(state, now / 1000);
  hud.update(state.economy, state.building);
  requestAnimationFrame(frame);
});

hud.showMessage(`Welcome ${state.player.name}, good luck!`, 20_000);
