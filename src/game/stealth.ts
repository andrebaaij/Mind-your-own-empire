/**
 * Hiding from the Idirans. Everything the Mind owns gives off a signature: the Mind itself most
 * of all, then spires and collectors, then drones (more while they move). Idiran skimmers sweep
 * the ground; whatever they pick up raises their suspicion, and at 100% they've found the Mind.
 *
 * The Mind can run silent (everything at half speed, signatures at a third), keep drones under
 * the grove canopy, and plant decoy beacons: loud, convincing and fake. A skimmer that picks up a
 * decoy goes to look, smashes it, calms down a little, and searches around there for a while.
 */

import { TICK_RATE } from "./config";
import { distance, type Point } from "./coords";
import { inGrove } from "./cover";
import { type GameState, removeUnit, say } from "./state";
import { isFlying, isMobile, newWalk, type Unit } from "./units";

/** How far a skimmer's sensors reach. */
export const SENSOR_RADIUS = 6;
/** Signature multiplier while running silent. */
export const SILENT_FACTOR = 0.35;
/** Signature multiplier for drones under the grove canopy. */
const COVER_FACTOR = 0.4;
/** Weakest signal a skimmer notices. */
const NOTICE = 0.18;
/** Suspicion (percent) gained per second per unit of signal. */
const SUSPICION_RATE = 4;
/** A signal this strong makes a skimmer break off its search and close in. */
const CLOSE_IN = 0.45;
/** Suspicion lost per second while nothing is picked up. */
const SUSPICION_DECAY = 1.5;
/** How fast the search area shrinks (tiles of radius per second), and how small it gets. */
const NARROWING = 0.03;
const MIN_SEARCH_RADIUS = 10;
/** How fast the search centre creeps towards the Mind by triangulation, in tiles per second. */
const TRIANGULATION = 0.12;
/** How long a skimmer hovers over a contact before moving on, and how long it then ignores it. */
const INVESTIGATE_SECONDS = 6;
const IGNORE_SECONDS = 45;
/** How long a skimmer spends smashing a decoy, and how much that calms the search. */
const DECOY_SECONDS = 4;
const DECOY_RELIEF = 15;

export interface Search {
  /** Where the Idirans think the Mind came down, and how far around it they look. */
  center: Point;
  radius: number;
}

interface SkimmerMemory {
  decoy: Unit | null;
  inspecting: number;
  /** The contact it's closing in on, and how long it has hovered over it. */
  closing: Unit | null;
  hovered: number;
  /** Things it has looked at already, until when (in seconds of game time). */
  ignoring: Map<Unit, number>;
  /** Seconds left hovering at a waypoint, scanning. */
  pause: number;
}

const memories = new WeakMap<Unit, SkimmerMemory>();

function memoryOf(skimmer: Unit): SkimmerMemory {
  let memory = memories.get(skimmer);
  if (!memory) {
    memory = {
      decoy: null,
      inspecting: 0,
      pause: 0,
      closing: null,
      hovered: 0,
      ignoring: new Map(),
    };
    memories.set(skimmer, memory);
  }
  return memory;
}

export function isSkimmer(unit: Unit): boolean {
  return unit.faction === "idiran";
}

/** How loudly one of the player's units shows up on Idiran sensors. */
export function signature(state: GameState, unit: Unit): number {
  if (unit.name === "decoy") return 6;
  let loudness: number;
  if (unit.name === "mind") loudness = 2.5;
  else if (unit.name === "tower") loudness = 1.5;
  else if (unit.name === "solar") loudness = 1.2;
  else if (!isMobile(unit)) loudness = 1;
  else if (isFlying(unit)) loudness = unit.moving ? 1 : 0.5;
  else if (unit.moving) loudness = 0.9;
  else if (unit.actions.length > 0) loudness = 0.6;
  else loudness = 0.25;

  if (state.silent) loudness *= SILENT_FACTOR;
  if (inGrove(unit.position.x, unit.position.y)) {
    loudness *= isMobile(unit) && !isFlying(unit) ? COVER_FACTOR : 0.7;
  }
  return loudness;
}

/** What a skimmer at `from` picks up of `unit`: stronger for louder and closer things. */
export function signal(state: GameState, unit: Unit, from: Point): number {
  const d = distance(unit.position, from);
  if (d > SENSOR_RADIUS) return 0;
  return signature(state, unit) * (1 - d / SENSOR_RADIUS);
}

export function setSilent(state: GameState, silent: boolean): void {
  if (state.silent === silent) return;
  state.silent = silent;
  say(
    state,
    silent
      ? "Running silent. Everything at half speed, and we're a third as loud."
      : "Back to full power. And full volume.",
    silent ? "info" : "warning",
  );
}

/** Bring a skimmer in to join the search. */
export function arriveSkimmer(state: GameState, skimmer: Unit): void {
  memoryOf(skimmer);
  state.discovered.add("idirans");
}

/** One step of the Idiran search, `seconds` long. */
export function idiranThink(state: GameState, seconds: number): void {
  const search = state.search;
  if (!search) return;
  const skimmers = state.units.filter(isSkimmer);
  if (skimmers.length === 0) return;
  const ours = state.units.filter((u) => u.faction === "player");

  let noticed = false;
  for (const skimmer of skimmers) {
    const memory = memoryOf(skimmer);

    // Busy with a decoy: fly to it, look it over, smash it.
    if (memory.decoy) {
      const decoy = memory.decoy;
      if (!state.units.includes(decoy)) {
        memory.decoy = null;
      } else if (distance(decoy.position, skimmer.position) <= 1.6) {
        skimmer.actions = [];
        memory.inspecting += seconds;
        if (memory.inspecting >= DECOY_SECONDS) {
          smashDecoy(state, decoy);
          memory.decoy = null;
          memory.inspecting = 0;
        }
        continue;
      } else {
        if (skimmer.actions.length === 0) skimmer.actions = [newWalk(decoy.position)];
        continue;
      }
    }

    // What can it pick up from here? (Not what it has just looked at and dismissed.)
    const now = state.ticks / TICK_RATE;
    let best: Unit | null = null;
    let strongest = NOTICE;
    for (const unit of ours) {
      if ((memory.ignoring.get(unit) ?? 0) > now) continue;
      const s = signal(state, unit, skimmer.position);
      if (s > strongest) {
        strongest = s;
        best = unit;
      }
    }

    if (best?.name === "decoy") {
      memory.decoy = best;
      memory.inspecting = 0;
      skimmer.actions = [newWalk(best.position)];
      say(
        state,
        "A skimmer's taken the bait. Wonderful creatures, really. Very literal.",
        "success",
        {
          once: `bait-${best.id}`,
        },
      );
    } else if (best) {
      noticed = true;
      state.suspicion = Math.min(100, state.suspicion + strongest * SUSPICION_RATE * seconds);
      state.lastContact = { ...best.position };
      // A strong signal makes it close in and hover over the source for a while, then move on
      // (it can't tell a collector from a Mind without a better look, which costs it time).
      if (memory.closing === best && distance(skimmer.position, best.position) <= 1.5) {
        memory.hovered += seconds;
        if (memory.hovered >= INVESTIGATE_SECONDS) {
          memory.ignoring.set(best, now + IGNORE_SECONDS);
          memory.closing = null;
          skimmer.actions = [];
          memory.pause = 0;
        }
      } else if (strongest >= CLOSE_IN && memory.closing !== best) {
        memory.closing = best;
        memory.hovered = 0;
        skimmer.actions = [newWalk(best.position)];
      }
      // Every contact pulls the search towards it; the surer they are, the harder.
      const pull = state.suspicion > 50 ? 0.03 : 0.01;
      search.center.x += (best.position.x - search.center.x) * pull;
      search.center.y += (best.position.y - search.center.y) * pull;
    } else if (skimmer.actions.length === 0) {
      // Nothing here: hover and scan for a moment, then on to the next part of the search.
      memory.pause -= seconds;
      if (memory.pause <= 0) {
        const angle = state.random() * Math.PI * 2;
        const reach = Math.sqrt(state.random()) * search.radius;
        skimmer.actions = [
          newWalk({
            x: search.center.x + Math.cos(angle) * reach,
            y: search.center.y + Math.sin(angle) * reach,
          }),
        ];
        memory.pause = 1.5 + state.random() * 2;
      }
    }
  }

  if (!noticed) state.suspicion = Math.max(0, state.suspicion - SUSPICION_DECAY * seconds);
  // Given time, they narrow the search down, and triangulate on the Mind's emissions (more
  // slowly when it runs silent). Waiting them out doesn't work for long.
  search.radius = Math.max(MIN_SEARCH_RADIUS, search.radius - NARROWING * seconds);
  const mind = ours.find((u) => u.name === "mind");
  if (mind) {
    const d = distance(search.center, mind.position);
    const step = Math.min(d, TRIANGULATION * (state.silent ? 0.5 : 1) * seconds);
    if (d > 0) {
      search.center.x += ((mind.position.x - search.center.x) / d) * step;
      search.center.y += ((mind.position.y - search.center.y) / d) * step;
    }
  }
  warn(state);
}

function smashDecoy(state: GameState, decoy: Unit): void {
  const search = state.search;
  removeUnit(state, decoy);
  state.stats.decoysFound++;
  state.suspicion = Math.max(0, state.suspicion - DECOY_RELIEF);
  // They're sure they were close: the search moves to where the decoy was, and widens again.
  if (search) {
    search.center = { ...decoy.position };
    search.radius = Math.max(search.radius, 18);
  }
  say(
    state,
    state.stats.decoysFound === 1
      ? "They've smashed the decoy, and they're searching around it now. Good. Keep them there."
      : "Another decoy gone, and they're no wiser. Well, slightly wiser. Not wise enough.",
    "success",
  );
}

const WARNINGS = [
  { at: 35, key: "suspicion-35", text: "They've picked something up. Keep things quiet." },
  {
    at: 70,
    key: "suspicion-70",
    text: "They're very nearly sure. Whatever we're doing, stop doing it.",
  },
];

/** Warn as suspicion rises, once per rise (they can repeat after it's fallen well back). */
function warn(state: GameState): void {
  for (const warning of WARNINGS) {
    if (state.suspicion >= warning.at && !state.said.has(warning.key)) {
      say(state, warning.text, "warning", { once: warning.key });
    } else if (state.suspicion < warning.at - 20) {
      state.said.delete(warning.key);
    }
  }
}
