/**
 * Campaign missions: a briefing, objectives revealed one at a time, scripted lines from the
 * Mind, and win or lose conditions. See docs/World.md for the story they belong to.
 */
import { TICK_RATE } from "./config";
import { distance, gridRef } from "./coords";
import { isBuiltToPlan, setWardenHome } from "./custody";
import type { SiteSpec } from "./sites";
import {
  createGame,
  type GameState,
  type Player,
  removeUnit,
  type StartLayout,
  say,
  spawn,
} from "./state";
import { arriveSkimmer, guardCamp } from "./stealth";

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
  /** Tessilend sites the mission places by hand. */
  sites?: SiteSpec[];
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
/** The marker stone the first warden keeps straightening. */
const MARKER = { x: 4, y: -4 };

function arriveWarden(
  state: GameState,
  x: number,
  y: number,
  home = WARDEN_DRAW,
  patrol?: number,
): void {
  const warden = spawn(state, "warden", x, y, "custody");
  setWardenHome(warden, home, patrol);
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
  sites: [
    {
      kind: "marker",
      ...MARKER,
      text: "'Lessuin. Kept by the Custody for the Tessilend, until they return.' Ten thousand years old and still legible. So: the world is Lessuin, its builders were the Tessilend, and these are their staff.",
    },
  ],
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
        "It keeps going back to that stone north of the base and straightening it. There's writing on it.",
    },
    {
      text: "Read the marker stone",
      hint: "Select a worker drone and right-click the stone north of the base.",
      done: (state) => (state.stats.studied.marker ?? 0) >= 1,
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

// --- Mission 3 ------------------------------------------------------------------------------

const ARCHIVE = { x: -11, y: 0 };
const TAP = { x: 8, y: -18 };
const HABITAT = { x: 40, y: -11 };
const PLAN_BUILDINGS = 3;
const LATTICE_GOAL = 30;
const ALLOWED_LOSSES_3 = 3;

const builtToPlan = (state: GameState) =>
  state.units.filter((u) => u.faction === "player" && isBuiltToPlan(state, u)).length;

const houseRules: MissionDefinition = {
  id: "house-rules",
  number: 3,
  act: "Act I · Landfall",
  title: "House Rules",
  briefing: [
    "The staff tolerate the Mind the way a museum tolerates pigeons. They tidy away whatever is left lying about, and they have a very broad idea of 'lying about'.",
    "To stay, the Mind needs to know the rules of the house. The wardens keep visiting a Tessilend archive west of the base. Whatever they're so careful of, it's written down.",
  ],
  seed: "lessuin",
  layout: [
    ["mind", 5, 5],
    ["block", 3, 8],
    ["block", 4, 9],
    ["block", 8, 8],
    ["block", 2, 3],
    ["scout", 7, 1],
    ["solar", 10, 9],
    ["solar", 1, 11],
    ["solar", 12, 3],
    ["tower", 9, 12],
  ],
  iron: 250,
  sites: [
    { kind: "archive", ...ARCHIVE },
    { kind: "tap", ...TAP },
    { kind: "habitat", ...HABITAT },
  ],
  setup: (state) => {
    // The staff go about their rounds: one at the archive, one at the tap, one at the habitat.
    for (const [site, x, y] of [
      [ARCHIVE, -8, 4],
      [TAP, 11, -14],
      [HABITAT, 36, -6],
    ] as const) {
      arriveWarden(state, x, y, { x: site.x + 0.5, y: site.y + 0.5 });
    }
  },
  objectives: [
    {
      text: "Study the Tessilend archive",
      hint: "Select worker drones and right-click the archive west of the base. More drones read faster.",
      done: (state) => (state.stats.studied.archive ?? 0) >= 1,
      completed:
        "It's a building code. Ten thousand years of it. The short version: build on their foundations and the staff treat it as part of the estate. Build anywhere else and it's litter.",
    },
    {
      text: `Mine ${LATTICE_GOAL} lattice`,
      hint: "The green crystals around Tessilend sites. Drones mine it at half the speed of iron.",
      progress: (state) =>
        `${Math.min(state.stats.latticeDelivered, LATTICE_GOAL)} / ${LATTICE_GOAL}`,
      done: (state) => state.stats.latticeDelivered >= LATTICE_GOAL,
      completed: "Lattice. It hums, very faintly, in a key I don't recognise.",
    },
    {
      text: "Restore the power tap",
      hint: "It's north of the base. Study it with drones; bringing it back uses 30 lattice.",
      done: (state) => (state.stats.studied.tap ?? 0) >= 1,
    },
    {
      text: `Build ${PLAN_BUILDINGS} things on Tessilend paving`,
      hint: "The pale stone around the sites. The staff never tidy anything built to plan.",
      progress: (state) => `${Math.min(builtToPlan(state), PLAN_BUILDINGS)} / ${PLAN_BUILDINGS}`,
      done: (state) => builtToPlan(state) >= PLAN_BUILDINGS,
      completed:
        "The nearest warden just logged us. We've been reclassified from 'clutter' to 'contractor'. I've been called worse. I've been called 'it'.",
    },
    {
      text: "Find out what the staff are tending in the east",
      hint: "Send the scout east, past the ridge.",
      done: (state) =>
        state.units.some(
          (u) =>
            u.faction === "player" &&
            distance(u.position, { x: HABITAT.x + 0.5, y: HABITAT.y + 0.5 }) <= 9,
        ),
    },
  ],
  events: [
    {
      when: (state) => seconds(state) > 1,
      run: (state) =>
        say(
          state,
          "The staff tolerate us the way a museum tolerates pigeons. I'd like to learn the house rules before they decide we're an exhibit.",
        ),
    },
    {
      when: (state) => seconds(state) > 7,
      run: (state) => {
        // The archive is charted from the start: the wardens have worn a path to it.
        state.world.watch(gridRef(ARCHIVE.x, ARCHIVE.y), 4);
        state.world.unwatch(gridRef(ARCHIVE.x, ARCHIVE.y), 4);
        say(
          state,
          "There, west of the base: the archive the wardens keep visiting. Let's go and read it.",
        );
      },
    },
    {
      when: (_state, runtime) => runtime.current >= 2,
      run: (state) => {
        state.world.watch(gridRef(TAP.x, TAP.y), 5);
        state.world.unwatch(gridRef(TAP.x, TAP.y), 5);
        say(
          state,
          "The archive mentions a power tap just north of here, 'awaiting a qualified contractor'. I'm qualified. I'm fairly sure I'm qualified.",
        );
      },
    },
    {
      when: (_state, runtime) => runtime.current >= 4,
      run: (state) =>
        say(
          state,
          "One more thing. The wardens on the eastern ridge never come this way. Whatever they're looking after over there, it matters more to them than we do.",
        ),
    },
  ],
  failure: (state) =>
    state.stats.tidied > ALLOWED_LOSSES_3
      ? "The staff have tidied us away. The paperwork was immaculate."
      : null,
  victory:
    "Contractors, then. On probation, I imagine, for the next few thousand years. And somewhere out east there's a house with the lights on, waiting for someone.",
};

// --- Mission 4 ------------------------------------------------------------------------------

const HIDE_SECONDS = 150;
const DECOY_DISTANCE = 14;
const MIND = { x: 5.5, y: 5.5 };

function arriveIdiran(state: GameState, x: number, y: number): void {
  arriveSkimmer(state, spawn(state, "skimmer", x, y, "idiran"));
}

const farDecoys = (state: GameState) =>
  state.units.filter(
    (u) =>
      u.faction === "player" && u.name === "decoy" && distance(u.position, MIND) >= DECOY_DISTANCE,
  ).length;

const ahCompany: MissionDefinition = {
  id: "ah-company",
  number: 4,
  act: "Act II · Company",
  title: "Ah. Company.",
  briefing: [
    "Something has followed the Mind down. An Idiran scouting party has landed on Lessuin, and its skimmers are sweeping the country around the crash.",
    "They know roughly where it came down. They don't know exactly. The Mind would like to keep it that way: it can run silent, hide its drones under the groves, and give the Idirans something more interesting to find.",
  ],
  seed: "lessuin",
  layout: [
    ["mind", 5, 5],
    ["block", 3, 8],
    ["block", 4, 9],
    ["block", 8, 8],
    ["block", 2, 3],
    ["block", 9, 2],
    ["block", 7, 10],
    ["scout", 7, 1],
    ["solar", 10, 9],
    ["solar", 1, 11],
    ["solar", 12, 3],
    ["solar", -1, 4],
    ["tower", 9, 12],
  ],
  iron: 350,
  setup: (state) => {
    // The Mind improvises decoys from spare parts; the stealth controls are shown from the start.
    state.designs.add("decoy");
    state.discovered.add("idirans");
  },
  objectives: [
    {
      text: "Run silent",
      hint: "Press R, or the button by the power readout. Half speed, a third of the noise.",
      done: (state) => state.silent,
    },
    {
      text: "Plant a decoy beacon well away from the base",
      hint: `Press 5 and place it at least ${DECOY_DISTANCE} tiles from the Mind, out where the skimmers are searching.`,
      progress: (state) => `${Math.min(farDecoys(state), 1)} / 1`,
      done: (state) => farDecoys(state) >= 1,
      completed:
        "A decoy. It's very loud and very confident, and none of it is true. Like a diplomat.",
    },
    {
      text: "Lure a skimmer to a decoy",
      hint: "A skimmer that passes within 6 tiles of a decoy goes to look. Keep the base quiet meanwhile.",
      progress: (state) => `suspicion ${Math.round(state.suspicion)}%`,
      done: (state) => state.stats.decoysFound >= 1,
    },
    {
      text: "Stay hidden until they give up",
      hint: "Keep quiet, keep drones under the groves, and keep planting decoys.",
      progress: (state, runtime) =>
        `${clock(Math.max(0, HIDE_SECONDS - (runtime.elapsed - (runtime.counters.hideFrom ?? runtime.elapsed))))} left · suspicion ${Math.round(state.suspicion)}%`,
      done: (_state, runtime) =>
        runtime.elapsed - (runtime.counters.hideFrom ?? runtime.elapsed) >= HIDE_SECONDS,
    },
  ],
  events: [
    {
      when: (state) => seconds(state) > 1,
      run: (state) =>
        say(
          state,
          "Something's come over the horizon. Several somethings. They're not ours, and they're not the Custody's.",
          "warning",
        ),
    },
    {
      when: (state) => seconds(state) > 20,
      run: (state) => {
        state.search = { center: { x: MIND.x + 20, y: MIND.y - 16 }, radius: 22 };
        arriveIdiran(state, 48, -30);
        say(
          state,
          "Idiran skimmers. They know roughly where I came down; they don't know exactly. Let's keep it that way.",
          "warning",
        );
      },
    },
    {
      when: (state) => seconds(state) > 60,
      run: (state) => {
        arriveIdiran(state, -36, -28);
        say(
          state,
          "A second skimmer, from the west. They're thorough. It's practically their religion.",
        );
      },
    },
    {
      when: (state) => seconds(state) > 110,
      run: (state) => {
        arriveIdiran(state, 40, 44);
        say(state, "And a third. I'm flattered, in a terrified sort of way.");
      },
    },
    {
      // The clock starts once a decoy has worked (or after a while regardless).
      when: (state, runtime) => runtime.current >= 3 || seconds(state) > 180,
      run: (_state, runtime) => {
        runtime.counters.hideFrom = runtime.elapsed;
      },
    },
  ],
  failure: (state) =>
    state.suspicion >= 100 ? "Found. I can hear them calling it in. I'd hoped for longer." : null,
  victory:
    "They've gone, for now. Ah. Company: the kind that brings its own opinions about me. Next time I'd like some of my own ready.",
};

// --- Mission 5 ------------------------------------------------------------------------------

const SEEDBED = { x: -2, y: 22 };
const CAMPS: [number, number][] = [
  [-9, 24],
  [4, 27],
  [-3, 30],
];

/** How long until the Idirans have stripped the seedbed and moved on. */
const STRIP_SECONDS = 600;
const stripClock = (runtime: MissionRuntime) =>
  `seedbed stripped in ${clock(Math.max(0, STRIP_SECONDS - runtime.elapsed))}`;

const campsLeft = (state: GameState) =>
  state.units.filter((u) => u.faction === "idiran" && u.name === "camp").length;

const trespassers: MissionDefinition = {
  id: "trespassers",
  number: 5,
  act: "Act II · Company",
  title: "Trespassers",
  briefing: [
    "The Idirans didn't leave. They've dug in south of the base, around a Tessilend seedbed, and they're stripping its lattice for their war. Three camps, each with a skimmer standing guard.",
    "The Mind can't fight them. But the camps are in the Custody's territory, and the staff tidy away anything left unattended, Idiran or otherwise. The guards just need to be somewhere else for a little while.",
  ],
  seed: "lessuin",
  layout: [
    ["mind", 5, 5],
    ["block", 3, 8],
    ["block", 4, 9],
    ["block", 8, 8],
    ["block", 2, 3],
    ["scout", 7, 1],
    ["solar", 10, 9],
    ["solar", 12, 3],
    ["solar", -1, 4],
    ["tower", 9, 12],
  ],
  iron: 700,
  sites: [{ kind: "seedbed", ...SEEDBED }],
  setup: (state) => {
    state.designs.add("decoy");
    // They're dug in, not searching: detection still matters, but they won't close in.
    state.search = {
      center: { x: SEEDBED.x + 0.5, y: SEEDBED.y + 4.5 },
      radius: 8,
      closing: false,
    };
    for (const [x, y] of CAMPS) {
      const camp = spawn(state, "camp", x, y, "idiran");
      guardCamp(state, spawn(state, "skimmer", x + 2, y - 2, "idiran"), camp);
    }
    // The staff tend the seedbed, and take a dim view of the neighbours: one keeps a close eye
    // on each camp.
    for (const [x, y] of CAMPS) {
      arriveWarden(state, x, y - 4, { x: x + 0.5, y: y + 0.5 }, 6);
    }
  },
  objectives: [
    {
      text: "Find the Idiran camps",
      hint: "Run silent and send the scout south, carefully. Skimmers hear things up to 6 tiles away.",
      done: (state) =>
        state.stats.evicted > 0 ||
        state.units.some(
          (u) => u.name === "camp" && u.footprint.some((tile) => state.world.isExplored(tile)),
        ),
      completed:
        "There. Three camps around the seedbed, a skimmer on each, and the staff circling all of it with their lamps very bright. They don't like the neighbours either.",
    },
    {
      text: "Get the staff to evict a camp",
      progress: (_state, runtime) => stripClock(runtime),
      hint: "Wait for a warden to come near a camp, then plant a decoy 6–8 tiles out: the guard goes to smash it, and the staff move in. A second decoy about 4 tiles beyond the first keeps it away longer.",
      done: (state) => state.stats.evicted >= 1,
    },
    {
      text: "Evict every camp",
      hint: "Chain decoys away from each camp, about 4 tiles apart: a guard that smashes one hears the next.",
      progress: (state, runtime) =>
        `${CAMPS.length - campsLeft(state)} / ${CAMPS.length} · ${stripClock(runtime)}`,
      done: (state) => campsLeft(state) === 0,
    },
  ],
  events: [
    {
      when: (state) => seconds(state) > 1,
      run: (state) =>
        say(
          state,
          "South of here, around the seedbed. Something heavy is digging, and it isn't the staff.",
        ),
    },
    {
      when: (state) => campsLeft(state) === 0,
      run: (state) => {
        // With their camps gone, the guards leave too.
        for (const unit of [...state.units]) if (unit.faction === "idiran") removeUnit(state, unit);
      },
    },
  ],
  failure: (state, runtime) => {
    if (state.suspicion >= 100) return "They've traced the decoys back to us. Found.";
    if (runtime.elapsed >= STRIP_SECONDS && campsLeft(state) > 0)
      return "They've stripped the seedbed bare and moved on. The staff will be a long time forgiving us for watching.";
    return null;
  },
  victory:
    "The staff have evicted them: politely, thoroughly, and with what I can only describe as a receipt. I could get used to having landlords.",
};

export const MISSIONS: readonly MissionDefinition[] = [
  arrived,
  theStaff,
  houseRules,
  ahCompany,
  trespassers,
];

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
    ...(definition.sites ? { sites: definition.sites } : {}),
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
