import "../styles/game.css";
import { Ambience } from "./audio";
import { glowCss, playerColor } from "./colors";
import { MAX_TICKS_PER_FRAME, TICK_MS } from "./config";
import { Hud } from "./hud";
import { bindInput, setPaused } from "./input";
import { getMission, MISSIONS, markCompleted, startMission, updateMission } from "./missions";
import { Renderer } from "./renderer";
import { build, createGame, issueOrder, say, setSelection, tick } from "./state";

const params = new URLSearchParams(window.location.search);
const player = {
  name: params.get("name") || "Only Visiting",
  color: playerColor(params.get("color")),
};

// ?mission=<id> plays a campaign mission; anything else is the free-play survey.
const mission = getMission(params.get("mission") ?? "");
const state = mission
  ? startMission(mission, player)
  : createGame({ seed: params.get("seed") || "1500", player });

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

if (mission) {
  state.paused = true;
  hud.showBriefing(mission, () => {
    state.paused = false;
  });
} else {
  say(state, "Survey mode. No objectives, no deadlines, no one shooting. Enjoy it while it lasts.");
}

/** Link to a mission, keeping the player's name and colour. */
function missionHref(id: string): string {
  const query = new URLSearchParams({
    mission: id,
    name: player.name,
    color: params.get("color") ?? "",
  });
  return `./game.html?${query}`;
}

/** Show the win or lose screen once a mission is decided. */
function checkOutcome(): void {
  const runtime = state.mission;
  if (!runtime?.outcome || state.paused) return;
  state.paused = true;
  const { definition, outcome } = runtime;
  const kicker = `${definition.act} · Mission ${definition.number}`;
  if (outcome.won) {
    markCompleted(definition.id);
    const next = MISSIONS.find((m) => m.number === definition.number + 1);
    hud.showDialog({
      kicker,
      title: "Mission complete",
      paragraphs: [],
      quote: outcome.text,
      actions: [
        ...(next
          ? [{ label: `Next: ${next.title}`, primary: true, href: missionHref(next.id) }]
          : []),
        { label: "Main menu", primary: !next, href: "./index.html" },
      ],
    });
  } else {
    hud.showDialog({
      kicker,
      title: "Mission failed",
      paragraphs: [],
      quote: outcome.text,
      actions: [
        { label: "Try again", primary: true, href: missionHref(definition.id) },
        { label: "Main menu", href: "./index.html" },
      ],
    });
  }
}

const renderer = await Renderer.create(game, state.world);

const screen = bindInput(renderer, state, hud, game);

// Wind and distant chimes, once the player has clicked or pressed something. M mutes.
const ambience = new Ambience();
ambience.startOnFirstGesture();
document.addEventListener("keydown", (event) => {
  if (event.code !== "KeyM" || document.querySelector("#mission-dialog[open]")) return;
  hud.showMessage(ambience.toggleMuted() ? "Sound off." : "Sound on. Listen: wind.", 2_000);
});

// ?debug exposes the game to the console and to scripted browser tests.
if (params.has("debug")) {
  Object.assign(window, { mindGame: { state, renderer, issueOrder, setSelection, build } });
}

// Fixed-timestep simulation, decoupled from the display refresh rate.
let accumulator = 0;
let last = performance.now();
requestAnimationFrame(function frame(now) {
  accumulator = Math.min(accumulator + (now - last), TICK_MS * MAX_TICKS_PER_FRAME);
  last = now;
  while (accumulator >= TICK_MS) {
    tick(state);
    updateMission(state);
    accumulator -= TICK_MS;
  }
  checkOutcome();
  ambience.setPaused(state.paused);
  // The camera may have moved, so find the ground under the pointer again.
  state.pointer.world = screen.position ? renderer.groundAt(screen.position) : null;
  renderer.render(state, now / 1000);
  hud.update(state);
  requestAnimationFrame(frame);
});
