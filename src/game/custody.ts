/**
 * The Custody: the caretaker machines the Tessilend left behind. Their wardens patrol, and
 * dismantle any building that nobody is attending. A drone standing by, or a sensor spire's
 * coverage, is enough to make a warden leave it alone.
 */
import {
  ATTEND_RADIUS,
  INSPECT_SECONDS,
  SPIRE_ATTEND_RADIUS,
  TICK_RATE,
  TIDY_SECONDS,
  WARDEN_SIGHT,
} from "./config";
import { distance, type Point } from "./coords";
import { findFreeSpots } from "./pathfinding";
import { type GameState, removeUnit, say } from "./state";
import { isMobile, newWalk, type TidyAction, type Unit } from "./units";

/** How far from its home a warden wanders while patrolling. */
const PATROL_RADIUS = 11;

interface WardenMemory {
  home: Point;
  /** How far from home it wanders. */
  patrol: number;
  target: Unit | null;
  /** Tick at which an idle warden picks a new patrol point. */
  nextWander: number;
}

const memories = new WeakMap<Unit, WardenMemory>();

/** When each player building was first noticed lying unattended (by tick). */
const neglected = new WeakMap<Unit, number>();

function memoryOf(warden: Unit): WardenMemory {
  let memory = memories.get(warden);
  if (!memory) {
    memory = { home: { ...warden.position }, patrol: PATROL_RADIUS, target: null, nextWander: 0 };
    memories.set(warden, memory);
  }
  return memory;
}

/** Give a warden a patrol centre (by default, where it was created). */
export function setWardenHome(warden: Unit, home: Point, patrol = PATROL_RADIUS): void {
  const memory = memoryOf(warden);
  memory.home = { ...home };
  memory.patrol = patrol;
}

export function isWarden(unit: Unit): boolean {
  return unit.faction === "custody";
}

/**
 * Whether the Custody considers a building looked after. The Mind and sensor spires always are:
 * the Custody leaves alone anything that is itself keeping watch. So is anything built on
 * Tessilend foundations: that's built to plan, and the plan is sacred.
 */
export function isAttended(state: GameState, building: Unit): boolean {
  if (building.name === "mind" || building.name === "tower") return true;
  if (isBuiltToPlan(state, building)) return true;
  // A building is attended by its own side: our drones for ours, skimmers for an Idiran camp.
  return state.units.some((unit) => {
    if (unit.faction !== building.faction || unit === building) return false;
    const d = distance(unit.position, building.position);
    if (isMobile(unit)) return d <= ATTEND_RADIUS;
    return unit.name === "tower" && d <= SPIRE_ATTEND_RADIUS;
  });
}

/** A building standing on Tessilend paving. */
export function isBuiltToPlan(state: GameState, building: Unit): boolean {
  return building.footprint.length > 0 && building.footprint.every((t) => state.world.isPaved(t));
}

/** Buildings the Custody considers clutter when left alone: ours, and the Idirans'. */
function isTidyable(unit: Unit): boolean {
  return (unit.faction === "player" || unit.faction === "idiran") && !isMobile(unit);
}

/** The Custody has much less patience with Idiran camps than with ours, and takes them apart faster. */
function inspectSeconds(unit: Unit): number {
  return unit.faction === "idiran" ? INSPECT_SECONDS / 4 : INSPECT_SECONDS;
}

function tidySeconds(unit: Unit): number {
  return unit.faction === "idiran" ? TIDY_SECONDS / 2 : TIDY_SECONDS;
}

function isTarget(state: GameState, unit: Unit): boolean {
  return state.units.some((other) => isWarden(other) && memoryOf(other).target === unit);
}

/**
 * Track which buildings have been left unattended under a warden's eye, and for how long. A
 * building is only tidied after it has been neglected for INSPECT_SECONDS, which gives the
 * player a fair warning and time to respond.
 */
function updateNeglect(state: GameState): void {
  const wardens = state.units.filter(isWarden);
  for (const unit of state.units) {
    if (!isTidyable(unit)) continue;
    const watched = wardens.some((w) => distance(w.position, unit.position) <= WARDEN_SIGHT);
    if (!state.custodyTidying || !watched || isAttended(state, unit)) {
      neglected.delete(unit);
      unit.inspected = false;
    } else if (!neglected.has(unit)) {
      neglected.set(unit, state.ticks);
      unit.inspected = true;
      if (unit.faction === "player")
        say(
          state,
          `A warden is looking very hard at our ${unit.definition.label.toLowerCase()}. I'd send someone over.`,
          "warning",
          { once: "first-inspection" },
        );
    }
  }
}

function neglectedLongEnough(state: GameState, unit: Unit): boolean {
  const since = neglected.get(unit);
  return since !== undefined && state.ticks - since >= inspectSeconds(unit) * TICK_RATE;
}

/** Decide what each warden does next. Called a few times a second, not every tick. */
export function custodyThink(state: GameState): void {
  updateNeglect(state);
  for (const warden of state.units) {
    if (!isWarden(warden)) continue;
    const memory = memoryOf(warden);

    // Drop a target that is gone, or that somebody has come back to.
    if (memory.target) {
      const target = memory.target;
      const gone = !state.units.includes(target);
      if (!gone && !isAttended(state, target)) continue; // on its way, or busy tidying

      if (!gone && target.faction === "player" && warden.actions[0]?.kind === "tidy") {
        say(state, "A warden hesitates, then goes back to its rounds. Someone's home.", "info", {
          once: "warden-backs-off",
        });
      }
      target.dismantling = 0;
      memory.target = null;
      warden.actions = [];
      memory.nextWander = state.ticks + TICK_RATE * 2;
    }

    // Look for something left lying about (once the Custody has decided we're clutter).
    const candidates = !state.custodyTidying
      ? []
      : state.units
          .filter(
            (unit) =>
              isTidyable(unit) &&
              distance(unit.position, warden.position) <= WARDEN_SIGHT &&
              !isAttended(state, unit) &&
              neglectedLongEnough(state, unit) &&
              !isTarget(state, unit),
          )
          .sort(
            (a, b) => distance(a.position, warden.position) - distance(b.position, warden.position),
          );
    const target = candidates[0];
    if (target) {
      memory.target = target;
      // Walk to open ground beside it, not into the building itself.
      const beside = findFreeSpots(state.world, target.position, 1)[0] ?? target.position;
      warden.actions = [
        newWalk(beside),
        { kind: "tidy", target: { ...target.position }, building: target, progress: 0 },
      ];
      continue;
    }

    // Nothing to do: wander the patrol.
    if (warden.actions.length === 0 && state.ticks >= memory.nextWander) {
      const angle = state.random() * Math.PI * 2;
      const reach = state.random() * memory.patrol;
      warden.actions = [
        newWalk({
          x: memory.home.x + Math.cos(angle) * reach,
          y: memory.home.y + Math.sin(angle) * reach,
        }),
      ];
      memory.nextWander = state.ticks + TICK_RATE * (4 + state.random() * 4);
    }
  }
}

/** One tick of a warden dismantling a building. */
export function tidyTick(state: GameState, warden: Unit, action: TidyAction): void {
  const { building } = action;
  const reach = (building.definition.footprint ?? 1) / 2 + 1.6;
  const finish = () => {
    building.dismantling = 0;
    warden.actions.shift();
    memoryOf(warden).target = null;
  };

  if (!state.units.includes(building) || isAttended(state, building)) {
    finish();
    return;
  }
  // It couldn't get close enough (blocked in): give up rather than tidy from a distance.
  if (distance(warden.position, building.position) > reach) {
    finish();
    return;
  }

  action.progress += 1 / TICK_RATE;
  building.dismantling = Math.min(1, action.progress / tidySeconds(building));
  const ours = building.faction === "player";
  if (action.progress === 1 / TICK_RATE && ours) {
    say(
      state,
      `A warden is dismantling our ${building.definition.label.toLowerCase()}. Send a drone to stand by it.`,
      "warning",
    );
  }
  if (action.progress >= tidySeconds(building)) {
    removeUnit(state, building);
    if (ours) {
      state.stats.tidied++;
      say(state, "Tidied away. I'd object, but there's no one to object to.", "warning");
    } else {
      state.stats.evicted++;
      say(
        state,
        state.stats.evicted === 1
          ? "The staff have taken the Idiran camp apart, bolt by bolt, and stacked the bolts. Evicted."
          : "Another camp evicted. The staff are very thorough about unwanted guests.",
        "success",
      );
    }
    finish();
  }
}
