import "../styles/game.css";
import { glowCss, playerColor } from "./colors";
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
// Interface accents glow in the player's colour, like their drones.
document.documentElement.style.setProperty("--accent", glowCss(state.player.color));

// The interface is ready straight away; the 3D view follows once the GPU is set up.
const hud = new Hud({
  onBuild: (name) => {
    state.building = state.building === name ? null : name;
  },
  onResume: () => setPaused(state, hud, false),
});
hud.update(state);
hud.showMessage(`Welcome ${state.player.name}, good luck!`, 20_000);

const renderer = await Renderer.create(game, state.world);

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
  hud.update(state);
  requestAnimationFrame(frame);
});
