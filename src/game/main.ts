import "../styles/game.css";
import { Ambience } from "./audio";
import { glowCss, playerColor } from "./colors";
import { MAX_TICKS_PER_FRAME, TICK_MS } from "./config";
import { Hud } from "./hud";
import { bindInput, setPaused } from "./input";
import { Minimap } from "./minimap";
import {
  getMission,
  MISSIONS,
  type MissionDefinition,
  markCompleted,
  startMission,
  updateMission,
} from "./missions";
import { chooseQuality, Renderer } from "./renderer";
import { loadSaved, restore, saveGame } from "./save";
import { loadSettings } from "./settings";
import { bindSettings } from "./settingsPanel";
import { build, canBuild, createGame, issueOrder, say, setSelection, tick } from "./state";
import { setSilent } from "./stealth";
import { Voice } from "./voice";

const params = new URLSearchParams(window.location.search);
const player = {
  name: params.get("name") || "Only Visiting",
  color: playerColor(params.get("color")),
};

// ?load carries on from the save; ?mission=<id> plays a campaign mission; anything else is
// the free-play survey.
const saved = params.has("load") ? loadSaved() : null;
const state = saved
  ? restore(saved)
  : getMission(params.get("mission") ?? "")
    ? startMission(getMission(params.get("mission") ?? "") as MissionDefinition, player)
    : createGame({ seed: params.get("seed") || "1500", player });
const mission = state.mission?.definition;

const game = document.getElementById("game");
if (!game) throw new Error("Missing #game");
// Interface accents glow in the player's colour, like their drones.
document.documentElement.style.setProperty("--accent", glowCss(state.player.color));

// The interface is ready straight away; the 3D view follows once the GPU is set up.
const hud = new Hud({
  onBuild: (name) => {
    if (!canBuild(state, name)) return;
    state.building = state.building === name ? null : name;
  },
  onResume: () => setPaused(state, hud, false),
  onSilent: () => setSilent(state, !state.silent),
});
hud.update(state);

if (saved) {
  say(state, "Where were we? Ah, yes.");
} else if (mission) {
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

const settings = loadSettings();
const renderer = await Renderer.create(game, state.world, chooseQuality(params, settings.quality));

const screen = bindInput(renderer, state, hud, game);

const minimap = new Minimap(game, {
  look: (at) => {
    state.camera.target = { ...at };
  },
  order: (at) => issueOrder(state, at),
});
let minimapClock = 0;
let lastView: { x: number; y: number }[] = [];

// Wind and distant chimes, once the player has clicked or pressed something. M mutes.
const ambience = new Ambience();
ambience.startOnFirstGesture();
document.addEventListener("keydown", (event) => {
  if (event.code !== "KeyM" || document.querySelector("#mission-dialog[open]")) return;
  hud.showMessage(ambience.toggleMuted() ? "Sound off." : "Sound on. Listen: wind.", 2_000);
});

const voice = new Voice();
hud.onDisplay = (message) => {
  ambience.play(message.tone);
  voice.say(message.text);
};

/** Put the player's settings into effect. */
function applySettings(): void {
  document.documentElement.classList.toggle("text-large", settings.textSize === "large");
  ambience.setVolumes(settings);
  voice.enabled = settings.voice;
  voice.volume = settings.voiceVolume;
  if (!settings.voice) voice.stop();
  renderer.reducedMotion = settings.reducedMotion;
}
applySettings();

const settingsDialog = document.getElementById("settings") as HTMLDialogElement;
const settingsPanel = bindSettings(settingsDialog, settings, {
  apply: applySettings,
  testVoice: () => {
    const was = voice.enabled;
    voice.enabled = true;
    voice.say("I did say I was only visiting.");
    voice.enabled = was;
  },
  closed: () => {},
});
document.getElementById("pause-settings")?.addEventListener("click", () => settingsPanel.open());

/** Save the game, unless it's over; says so unless `quietly`. */
function save(quietly = false): void {
  if (state.mission?.outcome) return;
  const ok = saveGame(state);
  if (!quietly || !ok) {
    hud.showMessage(
      ok
        ? "Saved. Continue from the main menu."
        : "Couldn't save: the browser won't let me store it.",
      2_500,
      ok ? "success" : "warning",
    );
  }
}
document.getElementById("pause-save")?.addEventListener("click", () => save());
// Autosave every two minutes of play.
let lastAutosave = state.ticks;

// ?debug exposes the game to the console and to scripted browser tests.
if (params.has("debug")) {
  Object.assign(window, {
    mindGame: { state, renderer, issueOrder, setSelection, build, tick, updateMission },
  });
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
  if (state.ticks - lastAutosave >= 120 * 60) {
    lastAutosave = state.ticks;
    save(true);
  }
  ambience.setPaused(state.paused);
  ambience.playEvents(state.events);
  // The camera may have moved, so find the ground under the pointer again.
  state.pointer.world = screen.position ? renderer.groundAt(screen.position) : null;
  renderer.render(state, now / 1000);
  // The minimap's corners of view are found by ray-marching, so refresh them a few times a second.
  minimapClock += 1;
  if (minimapClock % 4 === 0) lastView = renderer.viewFootprint();
  minimap.update(state, 1 / 60, lastView);

  // Effects and sound have both seen this frame's events.
  state.events.length = 0;
  hud.update(state);
  requestAnimationFrame(frame);
});
