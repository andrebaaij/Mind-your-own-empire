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

const renderer = await Renderer.create(game);

const hud = new Hud({
  onBuild: (name) => {
    state.building = name;
  },
  onResume: () => setPaused(state, hud, false),
});

bindInput(renderer.app.canvas, state, hud);

// Start with the Mind in the middle of the screen.
const mind = state.units.find((unit) => unit.name === "mind");
if (mind) {
  state.camera.x = Math.round(renderer.width / 2 - mind.position.x);
  state.camera.y = Math.round(renderer.height / 2 - mind.position.y);
}

// Fixed-timestep simulation, decoupled from the display refresh rate.
let accumulator = 0;
renderer.app.ticker.add((ticker) => {
  accumulator = Math.min(accumulator + ticker.deltaMS, TICK_MS * MAX_TICKS_PER_FRAME);
  while (accumulator >= TICK_MS) {
    tick(state);
    accumulator -= TICK_MS;
  }
  renderer.render(state);
  hud.update(state.economy, state.building);
});

hud.showMessage(`Welcome ${state.player.name}, good luck!`, 20_000);
