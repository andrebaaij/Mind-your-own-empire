import "../styles/game.css";
import { loadModels } from "./assets";
import { Ambience } from "./audio";
import { Cinematic } from "./cinematic";
import { addToCodex, renderCodex } from "./codexStore";
import { glowCss, playerColor } from "./colors";
import { MAX_TICKS_PER_FRAME, TICK_MS } from "./config";
import { Hud } from "./hud";
import { bindInput, setPaused } from "./input";
import { LoadingScreen, nextPaint } from "./loading";
import { Minimap } from "./minimap";
import { getMission, MISSIONS, markCompleted, startMission, updateMission } from "./missions";
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
const chosen = getMission(params.get("mission") ?? "");
const seed = params.get("seed") || "1500";

// Up goes the loading screen (it's already on the page), named for what's being loaded.
const savedMission = saved?.missionId ? getMission(saved.missionId) : undefined;
const loading = new LoadingScreen(
  saved
    ? { kicker: "Continue", title: savedMission?.title ?? `Survey · world ${saved.seed}` }
    : chosen
      ? { kicker: `${chosen.act} · Mission ${chosen.number}`, title: chosen.title }
      : { kicker: "Survey · free play", title: `World ${seed}` },
);
loading.progress("Charting Lessuin", 0.05);
await nextPaint();

const state = saved
  ? restore(saved)
  : chosen
    ? startMission(chosen, player)
    : createGame({ seed, player });
const mission = state.mission?.definition;
// Nothing happens until the player can see it.
state.paused = true;
loading.progress("Waking the renderer", 0.25);
await nextPaint();

const game = document.getElementById("game");
if (!game) throw new Error("Missing #game");
// Interface accents glow in the player's colour, like their drones.
document.documentElement.style.setProperty("--accent", glowCss(state.player.color));

/** The mission intro, while it plays (and whether it's waiting to start). */
let cinematic: Cinematic | null = null;
let introPending = false;

// The interface sits under the loading screen until the 3D view is ready.
const hud = new Hud({
  onBuild: (name) => {
    if (!canBuild(state, name)) return;
    state.building = state.building === name ? null : name;
  },
  onResume: () => setPaused(state, hud, false),
  onSilent: () => setSilent(state, !state.silent),
});
hud.update(state);

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
// Authored models replace the built ones as they're loaded.
await loadModels((fraction) => loading.progress("Unpacking the drones", 0.3 + fraction * 0.05));
// Compile the shaders and draw the first frames behind the loading screen, so the game starts
// smoothly instead of stuttering through its first seconds.
await renderer.warmUp(state, (fraction) =>
  loading.progress(
    fraction < 0.6 ? "Compiling shaders" : "Growing the grass",
    0.35 + fraction * 0.6,
  ),
);
state.events.length = 0;
loading.progress("Briefing the drones", 1);

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

// The codex: what the Mind has learned, kept across games.
const codexDialog = document.getElementById("codex") as HTMLDialogElement;
document.getElementById("pause-codex")?.addEventListener("click", () => {
  renderCodex(document.getElementById("codex-entries") as HTMLElement);
  codexDialog.showModal();
});
const codexToast = document.getElementById("codex-toast") as HTMLOutputElement;
let codexToastTimer: number | undefined;
/** Pass newly learned entries to the stored codex, with a small notice. */
function recordLore(): void {
  if (state.newLore.length === 0) return;
  const fresh = addToCodex(state.newLore.splice(0));
  const last = fresh.at(-1);
  if (!last) return;
  codexToast.textContent = `Added to the codex: ${last.title}`;
  codexToast.hidden = false;
  window.clearTimeout(codexToastTimer);
  codexToastTimer = window.setTimeout(() => {
    codexToast.hidden = true;
  }, 3_500);
}

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
  const wallSeconds = Math.min(0.5, (now - last) / 1000);
  accumulator = Math.min(accumulator + (now - last), TICK_MS * MAX_TICKS_PER_FRAME);
  last = now;
  while (accumulator >= TICK_MS) {
    tick(state);
    updateMission(state);
    accumulator -= TICK_MS;
  }
  checkOutcome();
  recordLore();
  if (state.ticks - lastAutosave >= 120 * 60) {
    lastAutosave = state.ticks;
    save(true);
  }
  ambience.setPaused(state.paused);
  ambience.playEvents(state.events);
  // The camera may have moved, so find the ground under the pointer again.
  state.pointer.world = screen.position ? renderer.groundAt(screen.position) : null;
  if (introPending && mission?.intro) {
    introPending = false;
    cinematic = new Cinematic(
      state,
      mission.intro,
      { kicker: `${mission.act} · Mission ${mission.number}`, title: mission.title },
      () => {
        cinematic = null;
      },
      (text) => voice.say(text),
    );
  }
  // The intro keeps to the wall clock, even on a slow machine.
  cinematic?.update(wallSeconds);
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

// The world is drawn and running: take the loading screen away, then hand over to the player.
await loading.finish();
if (saved) {
  state.paused = false;
  say(state, "Where were we? Ah, yes.");
} else if (mission) {
  hud.showBriefing(mission, () => {
    // The intro tour, then the mission; it starts with the next frame.
    if (mission.intro) introPending = true;
    else state.paused = false;
  });
} else {
  state.paused = false;
  say(state, "Survey mode. No objectives, no deadlines, no one shooting. Enjoy it while it lasts.");
}
