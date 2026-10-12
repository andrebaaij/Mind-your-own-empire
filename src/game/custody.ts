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
import { type GameState, removeUnit, say } from "./state";
import { isMobile, newWalk, type TidyAction, type Unit } from "./units";

/** How far from its home a warden wanders while patrolling. */
const PATROL_RADIUS = 11;

interface WardenMemory {
  home: Point;
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
    memory = { home: { ...warden.position }, target: null, nextWander: 0 };
    memories.set(warden, memory);
  }
  return memory;
}

/** Give a warden a patrol centre (by default, where it was created). */
export function setWardenHome(warden: Unit, home: Point): void {
  memoryOf(warden).home = { ...home };
}

export function isWarden(unit: Unit): boolean {
  return unit.faction === "custody";
}

/**
 * Whether the Custody considers a building looked after. The Mind and sensor spires always are:
 * the Custody leaves alone anything that is itself keeping watch.
 */
export function isAttended(state: GameState, building: Unit): boolean {
  if (building.name === "mind" || building.name === "tower") return true;
  return state.units.some((unit) => {
    if (unit.faction !== "player" || unit === building) return false;
    const d = distance(unit.position, building.position);
    if (isMobile(unit)) return d <= ATTEND_RADIUS;
    return unit.name === "tower" && d <= SPIRE_ATTEND_RADIUS;
  });
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
    if (unit.faction !== "player" || isMobile(unit)) continue;
    const watched = wardens.some((w) => distance(w.position, unit.position) <= WARDEN_SIGHT);
    if (!state.custodyTidying || !watched || isAttended(state, unit)) {
      neglected.delete(unit);
      unit.inspected = false;
    } else if (!neglected.has(unit)) {
      neglected.set(unit, state.ticks);
      unit.inspected = true;
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
  return since !== undefined && state.ticks - since >= INSPECT_SECONDS * TICK_RATE;
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

      if (!gone && warden.actions[0]?.kind === "tidy") {
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
              unit.faction === "player" &&
              !isMobile(unit) &&
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
      warden.actions = [
        newWalk(target.position),
        { kind: "tidy", target: { ...target.position }, building: target, progress: 0 },
      ];
      continue;
    }

    // Nothing to do: wander the patrol.
    if (warden.actions.length === 0 && state.ticks >= memory.nextWander) {
      const angle = state.random() * Math.PI * 2;
      const reach = state.random() * PATROL_RADIUS;
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
  building.dismantling = Math.min(1, action.progress / TIDY_SECONDS);
  if (action.progress === 1 / TICK_RATE) {
    say(
      state,
      `A warden is dismantling our ${building.definition.label.toLowerCase()}. Send a drone to stand by it.`,
      "warning",
    );
  }
  if (action.progress >= TIDY_SECONDS) {
    removeUnit(state, building);
    state.stats.tidied++;
    say(state, "Tidied away. I'd object, but there's no one to object to.", "warning");
    finish();
  }
}
