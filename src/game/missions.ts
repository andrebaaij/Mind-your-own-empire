/**
 * Campaign missions: a briefing, objectives revealed one at a time, scripted lines from the
 * Mind, and win or lose conditions. See docs/World.md for the story they belong to.
 */
import { TICK_RATE } from "./config";
import { distance } from "./coords";
import { setWardenHome } from "./custody";
import {
  createGame,
  type GameState,
  type Player,
  removeUnit,
  type StartLayout,
  say,
  spawn,
} from "./state";

export interface Objective {
  text: string;
  /** A short hint shown under the objective while it's active. */
  hint?: string;
  /** Progress like "40 / 60", shown while the objective is active. */
  progress?: (state: GameState, runtime: MissionRuntime) => string;
  done: (state: GameState, runtime: MissionRuntime) => boolean;
  /** What the Mind says when the objective is completed. */
  completed?: string;
}

export interface MissionEvent {
  /** Fires once, the first tick `when` is true. */
  when: (state: GameState, runtime: MissionRuntime) => boolean;
  run: (state: GameState, runtime: MissionRuntime) => void;
}

export interface MissionDefinition {
  id: string;
  number: number;
  act: string;
  title: string;
  briefing: string[];
  seed: string;
  layout: StartLayout;
  iron: number;
  /** Extra setup after the starting units are placed. */
  setup?: (state: GameState) => void;
  objectives: Objective[];
  events?: MissionEvent[];
  /** A reason the mission is lost, or null while it's still on. */
  failure?: (state: GameState, runtime: MissionRuntime) => string | null;
  /** The Mind's line on winning. */
  victory: string;
}

export interface MissionRuntime {
  definition: MissionDefinition;
  /** Index of the objective currently being worked on. */
  current: number;
  /** Seconds since the mission started. */
  elapsed: number;
  fired: Set<number>;
  outcome: { won: boolean; text: string } | null;
  /** Free-form counters the mission's own scripts keep. */
  counters: Record<string, number>;
}

const seconds = (state: GameState) => state.ticks / TICK_RATE;
const count = (state: GameState, name: string) =>
  state.units.filter((u) => u.faction === "player" && u.name === name).length;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// --- Mission 1 ------------------------------------------------------------------------------

const arrived: MissionDefinition = {
  id: "arrived",
  number: 1,
  act: "Act I · Landfall",
  title: "Arrived",
  briefing: [
    "The Contact ship Only Visiting was surveying a quiet system at the edge of the war when an Idiran patrol found it. The ship is gone. Its Mind ejected in its armoured core and came down hard on the planet below.",
    "Most of its sensors are dead and it has three drones, built from the wreckage. The ground is rich in iron. That will have to do.",
  ],
  seed: "lessuin",
  layout: [
    ["mind", 5, 5],
    ["block", 2, 8],
    ["block", 3, 9],
    ["block", 4, 9],
    ["scout", 8, 2],
  ],
  iron: 120,
  objectives: [
    {
      text: "Mine iron and bring it home",
      hint: "Drag a box around your drones, then right-click the orange crystals.",
      progress: (state) => `${Math.min(state.stats.ironDelivered, 60)} / 60`,
      done: (state) => state.stats.ironDelivered >= 60,
      completed: "First loads home. Riveting, in the most literal sense.",
    },
    {
      text: "Build another worker drone",
      hint: "Press 1, then click near the Mind.",
      done: (state) => (state.stats.built.block ?? 0) >= 1,
      completed: "More hands. More mouths, too, in a manner of speaking. Watch the power.",
    },
    {
      text: "Keep the power positive",
      hint: "Press 2 to place a collector. Every drone uses one unit of power.",
      progress: (state) => `${state.economy.power >= 0 ? "+" : ""}${state.economy.power}`,
      done: (state) => (state.stats.built.solar ?? 0) >= 1 && state.economy.power >= 0,
      completed: "Sunlight. Free, plentiful, and nobody's shooting at it yet.",
    },
    {
      text: "Raise a sensor spire",
      hint: "Press 3. Spires see much further than drones.",
      done: (state) => count(state, "tower") >= 1,
      completed: "Better. I can see more of the place, and the place is mostly rust.",
    },
    {
      text: "Grow to eight worker drones, with power to spare",
      hint: "Each collector powers three drones.",
      progress: (state) => `${count(state, "block")} / 8 drones · power ${state.economy.power}`,
      done: (state) => count(state, "block") >= 8 && state.economy.power >= 0,
    },
  ],
  events: [
    {
      when: (state) => seconds(state) > 1,
      run: (state) => say(state, "Arrived. Not, I'll concede, in the manner intended."),
    },
    {
      when: (state) => seconds(state) > 9,
      run: (state) =>
        say(
          state,
          "The charts call this place Survey object 31-Ledger-7. I refuse to be marooned somewhere with a hyphen in its name.",
        ),
    },
    {
      // Nudge a player who hasn't started mining.
      when: (state) => seconds(state) > 40 && state.stats.ironDelivered === 0,
      run: (state) =>
        say(state, "The drones are waiting, which they're good at. Mining, less so, until asked."),
    },
  ],
  victory: "Sensors at four per cent. Drones at eight. Optimism at a cautious nine.",
};

// --- Mission 2 ------------------------------------------------------------------------------

const WARDEN_DRAW = { x: 5.5, y: 5.5 };
const SURVIVE_SECONDS = 180;
const ALLOWED_LOSSES = 2;

function arriveWarden(state: GameState, x: number, y: number): void {
  const warden = spawn(state, "warden", x, y, "custody");
  setWardenHome(warden, WARDEN_DRAW);
}

const theStaff: MissionDefinition = {
  id: "the-staff",
  number: 2,
  act: "Act I · Landfall",
  title: "The Staff",
  briefing: [
    "The base is coming along. Collectors, a handful of drones, iron in the store. Then something on the long-range edge of the sensors starts moving, slowly, with purpose.",
    "Whoever built this world left it in someone's care. The Mind would like to meet them before they meet its collectors.",
  ],
  seed: "lessuin",
  layout: [
    ["mind", 5, 5],
    ["block", 3, 8],
    ["block", 4, 9],
    ["block", 8, 8],
    ["block", 9, 2],
    ["scout", 7, 1],
    ["solar", 10, 9],
    ["solar", 1, 11],
    ["solar", 12, 3],
    ["solar", -1, 4],
    ["solar", 9, 13],
  ],
  iron: 300,
  // The wardens look around first; they start tidying once the player has met one.
  setup: (state) => {
    state.custodyTidying = false;
  },
  objectives: [
    {
      text: "Watch a warden up close",
      hint: "Keep a drone or the scout within 5 tiles of a warden.",
      progress: (_state, runtime) => `${Math.floor(runtime.counters.watched ?? 0)} / 10 s`,
      done: (_state, runtime) => (runtime.counters.watched ?? 0) >= 10,
      completed:
        "There's a plaque on this one. Ten thousand years old, and still legible: this world is called Lessuin. Its builders were the Tessilend. These are their staff.",
    },
    {
      text: "Hold on to your base",
      hint: "Wardens leave alone buildings with a drone nearby or under a sensor spire.",
      progress: (state, runtime) =>
        `${clock(Math.max(0, SURVIVE_SECONDS - (runtime.elapsed - (runtime.counters.holdFrom ?? runtime.elapsed))))} left · ${state.stats.tidied} / ${ALLOWED_LOSSES} lost`,
      done: (_state, runtime) =>
        runtime.elapsed - (runtime.counters.holdFrom ?? runtime.elapsed) >= SURVIVE_SECONDS,
    },
  ],
  events: [
    {
      when: (state) => seconds(state) > 1,
      run: (state) =>
        say(state, "Movement at the edge of what's left of my sensors. Several things, unhurried."),
    },
    {
      when: (state) => seconds(state) > 8,
      run: (state) => {
        arriveWarden(state, 24, 2);
        say(state, "Someone's tidying up. Whoever it is, they've been at it for a while.");
      },
    },
    {
      // The staff arrive one at a time, so the first can be studied in peace.
      when: (state) => seconds(state) > 45,
      run: (state) => {
        arriveWarden(state, -10, 16);
        say(state, "Another one. They seem to be sending whoever's free.");
      },
    },
    {
      when: (state) => seconds(state) > 80,
      run: (state) => {
        arriveWarden(state, 16, 22);
        say(state, "And a third. We are clearly the most interesting mess for some distance.");
      },
    },
    {
      // Start the hold-out clock once the first objective is done.
      when: (state, runtime) => runtime.current >= 1 || seconds(state) > 60,
      run: (state, runtime) => {
        state.custodyTidying = true;
        runtime.counters.holdFrom = runtime.elapsed;
        say(
          state,
          "They don't fight. They tidy, and to them we're clutter. Keep someone by anything you'd like to keep.",
        );
      },
    },
  ],
  failure: (state) =>
    state.stats.tidied > ALLOWED_LOSSES ? "The staff have tidied us away. Politely." : null,
  victory: "They're not hostile. They're house-proud. I can work with house-proud.",
};

export const MISSIONS: readonly MissionDefinition[] = [arrived, theStaff];

export function getMission(id: string): MissionDefinition | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** Start a mission: a fresh game laid out for it, paused until the briefing is dismissed. */
export function startMission(definition: MissionDefinition, player: Player): GameState {
  const state = createGame({
    seed: definition.seed,
    player,
    layout: definition.layout,
    iron: definition.iron,
  });
  definition.setup?.(state);
  state.mission = {
    definition,
    current: 0,
    elapsed: 0,
    fired: new Set(),
    outcome: null,
    counters: {},
  };
  return state;
}

/** Advance the mission's scripts and objectives. Call after each simulation tick. */
export function updateMission(state: GameState): void {
  const runtime = state.mission;
  if (!runtime || runtime.outcome || state.paused) return;
  const { definition } = runtime;
  runtime.elapsed = seconds(state);

  // Mission-specific counters.
  if (definition.id === "the-staff") watchWardens(state, runtime);

  definition.events?.forEach((event, index) => {
    if (!runtime.fired.has(index) && event.when(state, runtime)) {
      runtime.fired.add(index);
      event.run(state, runtime);
    }
  });

  const failure = definition.failure?.(state, runtime);
  if (failure) {
    runtime.outcome = { won: false, text: failure };
    return;
  }

  // Objectives complete in order; several can complete in the same tick.
  while (runtime.current < definition.objectives.length) {
    const objective: Objective | undefined = definition.objectives[runtime.current];
    if (!objective?.done(state, runtime)) break;
    if (objective.completed) say(state, objective.completed, "success");
    runtime.current++;
  }
  if (runtime.current >= definition.objectives.length) {
    runtime.outcome = { won: true, text: definition.victory };
  }
}

/** Mission 2: seconds spent with one of our units near a warden. */
function watchWardens(state: GameState, runtime: MissionRuntime): void {
  const watching = state.units.some(
    (unit) =>
      unit.faction === "player" &&
      unit.definition.skills.walk &&
      state.units.some((w) => w.faction === "custody" && distance(w.position, unit.position) <= 5),
  );
  if (watching) runtime.counters.watched = (runtime.counters.watched ?? 0) + 1 / TICK_RATE;
}

/** Remove every warden (used by tests and by the sandbox). */
export function clearWardens(state: GameState): void {
  for (const unit of [...state.units]) if (unit.faction === "custody") removeUnit(state, unit);
}

// --- Progress ---------------------------------------------------------------------------------

const PROGRESS_KEY = "mind-your-own-empire:completed";

/** Missions completed in this browser. Storage can be unavailable; then nothing is remembered. */
export function completedMissions(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function markCompleted(id: string): void {
  try {
    const done = completedMissions();
    done.add(id);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...done]));
  } catch {
    // Progress just won't be saved.
  }
}

/** A mission can be played once the one before it is done. */
export function isUnlocked(definition: MissionDefinition, completed: Set<string>): boolean {
  const previous = MISSIONS.find((m) => m.number === definition.number - 1);
  return !previous || completed.has(previous.id);
}
