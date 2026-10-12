import {
  ARRIVAL_RADIUS,
  BLOCKED_WAIT_TICKS,
  DEFAULT_SPEED,
  GATHER_PER_SECOND,
  MAX_REPATHS,
  TICK_RATE,
  UNIT_RADIUS,
} from "./config";
import { type GridRef, gridFromWorld, gridRef, type Point, worldFromGrid } from "./coords";
import {
  type Faction,
  getObjectDefinition,
  getResourceDefinition,
  type ObjectDefinition,
  type ObjectName,
  type Skill,
} from "./definitions";
import { findPath, hasClearLine, tileKey } from "./pathfinding";
import type { Site } from "./sites";
import type { Resource, ResourceKind, World } from "./world";

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface WalkAction {
  kind: "walk";
  target: Point;
  /** Remaining waypoints, planned when the walk starts (null until then). */
  path: Point[] | null;
  /** Ticks spent waiting on another unit in the way. */
  waitTicks: number;
  /** Times the route has been re-planned because the unit got stuck. */
  repaths: number;
  /** `World.knownObstaclesVersion` when the route was planned. */
  plannedAt: number;
  /** Where the unit was when the walk started; bounds how far re-plans may detour. */
  origin: Point | null;
}

export interface GatherAction {
  kind: "gather";
  target: Point;
  resource: Resource;
}

/** Hand what a unit is carrying over to the Mind. */
export interface DeliverAction {
  kind: "deliver";
  target: Point;
}

/** A warden dismantling a building it considers unattended. */
export interface TidyAction {
  kind: "tidy";
  target: Point;
  building: Unit;
  /** Seconds spent so far. */
  progress: number;
}

/** A worker drone studying (or restoring) a Tessilend site. */
export interface StudyAction {
  kind: "study";
  target: Point;
  site: Site;
}

export type Action = WalkAction | GatherAction | DeliverAction | TidyAction | StudyAction;

export interface Unit {
  id: number;
  name: ObjectName;
  definition: ObjectDefinition;
  faction: Faction;
  /** Ground position (tiles). */
  position: Point;
  grid: GridRef;
  /** Facing on the ground plane, in radians (0 = +x, π/2 = +y). */
  heading: number;
  /** Whether the unit moved during the last tick, for animation. */
  moving: boolean;
  /** Tiles a building stands on; empty for mobile units. */
  footprint: GridRef[];
  actions: Action[];
  selected: boolean;
  color: Color;
  carrying: Record<ResourceKind, number>;
  /** Fraction of the next unit of work (e.g. iron mined) done so far. */
  workProgress: number;
  /** How far a warden has got dismantling this building, from 0 to 1. */
  dismantling?: number;
  /** Whether a warden has noticed this building standing unattended. */
  inspected?: boolean;
}

let nextId = 1;

export function createUnit(
  world: World,
  name: ObjectName,
  gx: number,
  gy: number,
  color: Color,
  faction: Faction = "player",
): Unit {
  const definition = getObjectDefinition(name);
  const position = worldFromGrid(gx, gy);
  const grid = gridFromWorld(position);
  const footprint = definition.skills.walk ? [] : footprintTiles(definition, gx, gy);

  const unit: Unit = {
    id: nextId++,
    name,
    definition,
    faction,
    position,
    grid,
    heading: Math.PI / 4,
    moving: false,
    footprint,
    actions: [],
    selected: false,
    color,
    carrying: { iron: 0, lattice: 0 },
    workProgress: 0,
  };

  // Only the player's units reveal the map to the player.
  if (faction === "player") world.watch(grid, definition.communicationRadius);
  world.occupy(footprint, 1);
  return unit;
}

/** Take a unit off the map: its sight and the ground it stood on are released. */
export function destroyUnit(world: World, unit: Unit): void {
  if (unit.faction === "player") world.unwatch(unit.grid, unit.definition.communicationRadius);
  world.occupy(unit.footprint, -1);
  unit.actions = [];
}

/** The square of tiles a building centred on tile (gx, gy) stands on. */
export function footprintTiles(definition: ObjectDefinition, gx: number, gy: number): GridRef[] {
  const size = definition.footprint ?? 1;
  const reach = Math.floor(size / 2);
  const tiles: GridRef[] = [];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) tiles.push(gridRef(gx + dx, gy + dy));
  }
  return tiles;
}

export function hasSkill(unit: Unit, skill: Skill): boolean {
  return unit.definition.skills[skill] === true;
}

export function isFlying(unit: Unit): boolean {
  return unit.definition.movement === "air";
}

/** Distance covered per tick. */
export function speedPerTick(unit: Unit): number {
  return (unit.definition.speed ?? DEFAULT_SPEED) / TICK_RATE;
}

/** Move a unit, keeping the fog of war in sync when it crosses into a new tile. */
export function moveBy(world: World, unit: Unit, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  unit.position.x += dx;
  unit.position.y += dy;
  unit.heading = Math.atan2(dy, dx);
  unit.moving = true;

  const grid = gridFromWorld(unit.position);
  if (grid.x !== unit.grid.x || grid.y !== unit.grid.y) {
    if (unit.faction === "player") {
      world.unwatch(unit.grid, unit.definition.communicationRadius);
      world.watch(grid, unit.definition.communicationRadius);
    }
    unit.grid = grid;
  }
}

export function newWalk(target: Point): WalkAction {
  return {
    kind: "walk",
    target: { ...target },
    path: null,
    waitTicks: 0,
    repaths: 0,
    plannedAt: -1,
    origin: null,
  };
}

/** Queue a walk to `target`. The route is planned when the walk starts. */
export function queueWalk(unit: Unit, target: Point): void {
  unit.actions.push(newWalk(target));
}

export function queueGather(unit: Unit, resource: Resource): void {
  queueWalk(unit, resource.position);
  unit.actions.push({ kind: "gather", target: { ...resource.position }, resource });
}

/** Where the unit will be once its queued orders are done. */
export function finalPosition(unit: Unit): Point {
  return unit.actions.at(-1)?.target ?? unit.position;
}

/** Remove the next action. A walk leading to another action is removed together with it. */
export function cancelNextAction(unit: Unit): void {
  const [first, second] = unit.actions;
  if (first?.kind === "walk" && second && second.kind !== "walk") {
    unit.actions.splice(0, 2);
  } else {
    unit.actions.splice(0, 1);
  }
  // The next walk starts from wherever the unit is now.
  const next = unit.actions[0];
  if (next?.kind === "walk") next.path = null;
}

export function cancelAllActions(unit: Unit): void {
  unit.actions = [];
}

export function isMobile(unit: Unit): boolean {
  return hasSkill(unit, "walk");
}

function isWalking(unit: Unit): boolean {
  return unit.actions[0]?.kind === "walk";
}

/** A mobile unit that stepping to `next` would bump into. Moving apart is always allowed. */
function blockingUnit(unit: Unit, next: Point, others: readonly Unit[]): Unit | undefined {
  const space = 2 * UNIT_RADIUS;
  return others.find((other) => {
    // Ground and air units are on different layers and pass over/under each other.
    if (other === unit || !isMobile(other) || isFlying(other) !== isFlying(unit)) return false;
    const after = Math.hypot(other.position.x - next.x, other.position.y - next.y);
    const before = Math.hypot(
      other.position.x - unit.position.x,
      other.position.y - unit.position.y,
    );
    return after < space && after < before;
  });
}

/** Turns tried when swerving, in degrees clockwise. Right first, so two units meeting
 * head-on both keep right and pass each other instead of mirroring each other's dodge. */
const SWERVE_ANGLES = [45, 90, -45, -90].map((degrees) => (degrees * Math.PI) / 180);

/** Whether a ground unit may step to `next`: open ground, and no cliff from its current tile. */
function canWalkTo(world: World, unit: Unit, next: Point): boolean {
  const tile = gridFromWorld(next);
  if (tile.x === unit.grid.x && tile.y === unit.grid.y) return true;
  return world.isPassable(tile) && world.canClimb(unit.grid, tile);
}

/** A free spot one step to the side of the heading (ux, uy), if there is one. */
function sidestep(
  world: World,
  unit: Unit,
  ux: number,
  uy: number,
  step: number,
  others: readonly Unit[],
): Point | null {
  for (const angle of SWERVE_ANGLES) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const candidate = {
      x: unit.position.x + (ux * cos - uy * sin) * step,
      y: unit.position.y + (ux * sin + uy * cos) * step,
    };
    if (!isFlying(unit) && !canWalkTo(world, unit, candidate)) continue;
    if (!blockingUnit(unit, candidate, others)) return candidate;
  }
  return null;
}

/**
 * Re-plan around whatever is in the way, or end the walk when the unit is already close
 * enough or has re-planned too often (Age of Empires style: get as close as you can, then stop).
 */
function replan(world: World, unit: Unit, action: WalkAction, avoid: ReadonlySet<string>): void {
  const remaining = Math.hypot(
    action.target.x - unit.position.x,
    action.target.y - unit.position.y,
  );
  if (remaining <= ARRIVAL_RADIUS || action.repaths >= MAX_REPATHS) {
    unit.actions.shift();
    return;
  }
  action.repaths++;
  action.waitTicks = 0;
  plan(world, unit, action, avoid);
}

function plan(world: World, unit: Unit, action: WalkAction, avoid?: ReadonlySet<string>): void {
  // Fliers go straight over terrain and buildings.
  action.origin ??= { ...unit.position };
  const options = avoid ? { avoid, anchor: action.origin } : { anchor: action.origin };
  action.path = isFlying(unit)
    ? [{ ...action.target }]
    : findPath(world, unit.position, action.target, options);
  action.plannedAt = world.knownObstaclesVersion;
}

/** Whether the rest of the route still avoids every obstacle the player knows about. */
function routeStillClear(world: World, unit: Unit, path: readonly Point[]): boolean {
  let from = unit.position;
  for (const point of path) {
    if (!hasClearLine(world, from, point)) return false;
    from = point;
  }
  return true;
}

/** Shared per-tick allowance for route planning, so a big group order can't stall a frame. */
export interface PathBudget {
  remaining: number;
}

/** What units need from the rest of the game while they work. */
export interface UnitContext {
  budget: PathBudget;
  /** Speed and work-rate multiplier, e.g. less than 1 during a power shortage. */
  power(unit: Unit): number;
  /** Where a unit should take what it carries, or null if there's nowhere. */
  dropOff(unit: Unit): Point | null;
  /** Hand over some of a resource; returns how much was accepted. */
  deposit(unit: Unit, kind: ResourceKind, amount: number): number;
  /** Advance a warden's tidying. */
  tidy(unit: Unit, action: TidyAction): void;
  /** Advance a drone's study of a Tessilend site. */
  study(unit: Unit, action: StudyAction): void;
}

/** A context for units working on their own: no power limits and nowhere to deliver. */
export function standaloneContext(): UnitContext {
  return {
    budget: { remaining: Number.POSITIVE_INFINITY },
    power: () => 1,
    dropOff: () => null,
    deposit: () => 0,
    tidy: (unit) => {
      unit.actions.shift();
    },
    study: (unit) => {
      unit.actions.shift();
    },
  };
}

function walkTick(
  world: World,
  unit: Unit,
  action: WalkAction,
  others: readonly Unit[],
  ctx: UnitContext,
): void {
  const { budget } = ctx;
  if (!action.path) {
    if (budget.remaining <= 0) return; // wait for a planning slot next tick
    budget.remaining--;
    plan(world, unit, action);
  } else if (
    !isFlying(unit) &&
    action.plannedAt !== world.knownObstaclesVersion &&
    budget.remaining > 0
  ) {
    // The player learned of new obstacles (acid or a cliff came into view, a building went up). Routes
    // through the fog were planned optimistically, so re-plan if this one now runs into one.
    if (routeStillClear(world, unit, action.path)) {
      action.plannedAt = world.knownObstaclesVersion;
    } else {
      budget.remaining--;
      plan(world, unit, action);
    }
  }
  if (!action.path) return;

  const waypoint = action.path[0];
  if (!waypoint) {
    unit.actions.shift();
    return;
  }

  const dx = waypoint.x - unit.position.x;
  const dy = waypoint.y - unit.position.y;
  const distance = Math.hypot(dx, dy);
  const speed = speedPerTick(unit) * ctx.power(unit);
  const step = Math.min(speed, distance);
  const next =
    distance === 0
      ? waypoint
      : {
          x: unit.position.x + (dx / distance) * step,
          y: unit.position.y + (dy / distance) * step,
        };

  // Safety net: never step onto ground that is actually blocked or up a cliff, known or not.
  if (!isFlying(unit) && !canWalkTo(world, unit, next)) {
    replan(world, unit, action, new Set());
    return;
  }

  // Another unit in the way. If it is parked on our destination, close enough counts as
  // arrived. Otherwise swerve past it, or give a moving unit a moment to clear; when that
  // takes too long, plan a route around it.
  const blocker = blockingUnit(unit, next, others);
  if (blocker) {
    action.waitTicks++;
    const remaining = Math.hypot(
      action.target.x - unit.position.x,
      action.target.y - unit.position.y,
    );
    if (remaining <= ARRIVAL_RADIUS && !isWalking(blocker)) {
      unit.actions.shift();
      return;
    }
    if (action.waitTicks < BLOCKED_WAIT_TICKS) {
      const swerve = sidestep(world, unit, dx / distance, dy / distance, step, others);
      if (swerve) {
        moveBy(world, unit, swerve.x - unit.position.x, swerve.y - unit.position.y);
        return;
      }
      if (isWalking(blocker)) return;
    }
    replan(world, unit, action, new Set([tileKey(blocker.grid.x, blocker.grid.y)]));
    return;
  }
  action.waitTicks = 0;

  moveBy(world, unit, next.x - unit.position.x, next.y - unit.position.y);

  if (distance <= speed) {
    // Snap exactly onto the waypoint so rounding can't leave the unit a hair short.
    unit.position.x = waypoint.x;
    unit.position.y = waypoint.y;
    action.path.shift();
    if (action.path.length === 0) unit.actions.shift();
  }
}

/**
 * Mine until full, then fly the load home and come back, AoE-villager style. Without a home to
 * deliver to, the unit simply stops when full.
 */
/** Everything a unit is carrying, of every kind. */
export function load(unit: Unit): number {
  return unit.carrying.iron + unit.carrying.lattice;
}

function gatherTick(world: World, unit: Unit, action: GatherAction, ctx: UnitContext): void {
  const capacity = unit.definition.capacity?.load ?? Number.POSITIVE_INFINITY;
  const exhausted = !action.resource.exists;
  const { kind } = action.resource;

  if (exhausted || load(unit) >= capacity) {
    if (exhausted) unit.actions.shift();
    const home = load(unit) > 0 ? ctx.dropOff(unit) : null;
    if (home) {
      const back = exhausted ? [] : [newWalk(action.resource.position)];
      unit.actions.unshift(newWalk(home), { kind: "deliver", target: { ...home } }, ...back);
    } else if (!exhausted) {
      unit.actions.shift();
    }
    return;
  }

  const rate = getResourceDefinition(kind).rate ?? 1;
  unit.workProgress += ((GATHER_PER_SECOND * rate) / TICK_RATE) * ctx.power(unit);
  while (unit.workProgress >= 1 && load(unit) < capacity && action.resource.exists) {
    unit.workProgress -= 1;
    unit.carrying[kind] += world.gather(action.resource, 1);
  }
}

function deliverTick(unit: Unit, ctx: UnitContext): void {
  unit.actions.shift();
  for (const kind of ["iron", "lattice"] as const) {
    if (unit.carrying[kind] > 0)
      unit.carrying[kind] -= ctx.deposit(unit, kind, unit.carrying[kind]);
  }
  // The store is full: stop rather than shuttle the same load back and forth.
  if (load(unit) > 0) unit.actions = [];
}

/** Advance one unit by one simulation tick. */
export function updateUnit(
  world: World,
  unit: Unit,
  others: readonly Unit[],
  ctx: UnitContext = standaloneContext(),
): void {
  unit.moving = false;
  const action = unit.actions[0];
  if (!action) return;
  switch (action.kind) {
    case "walk":
      walkTick(world, unit, action, others, ctx);
      break;
    case "gather":
      gatherTick(world, unit, action, ctx);
      break;
    case "deliver":
      deliverTick(unit, ctx);
      break;
    case "tidy":
      ctx.tidy(unit, action);
      break;
    case "study":
      ctx.study(unit, action);
      break;
  }
}
