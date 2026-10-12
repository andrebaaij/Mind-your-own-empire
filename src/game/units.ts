import {
  ARRIVAL_RADIUS,
  BLOCKED_WAIT_TICKS,
  GATHER_RATE,
  MAX_REPATHS,
  UNIT_RADIUS,
  WALK_SPEED,
} from "./config";
import {
  type GridRef,
  gridFromWorld,
  gridRef,
  type Point,
  type Rect,
  worldFromGrid,
} from "./coords";
import {
  type Box,
  type Direction,
  getObjectDefinition,
  getTileset,
  type ObjectDefinition,
  type ObjectName,
  type Skill,
  type TilesetDefinition,
} from "./definitions";
import { findPath, hasClearLine, tileKey } from "./pathfinding";
import type { Resource, World } from "./world";

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
}

export interface GatherAction {
  kind: "gather";
  target: Point;
  resource: Resource;
}

export type Action = WalkAction | GatherAction;

export interface Unit {
  id: number;
  name: ObjectName;
  definition: ObjectDefinition;
  tileset: TilesetDefinition;
  /** World position of the centre of the collision box. */
  position: Point;
  grid: GridRef;
  /** Sprite offset from the top-left of the tile frame to `position`. */
  center: Point;
  collisionBox: Box;
  /** Tiles a building stands on; empty for mobile units. */
  footprint: GridRef[];
  actions: Action[];
  animation: { name: string; direction: Direction; index: number };
  /** Current frame index in the tileset. */
  frame: number;
  selected: boolean;
  color: Color;
  carrying: { iron: number };
}

let nextId = 1;

const DEFAULT_BOX: Box = { lx: 0, ty: 0, rx: 0, by: 0 };

export function boxCenter(box: Box): Point {
  return { x: (box.lx + box.rx) / 2, y: (box.ty + box.by) / 2 };
}

export function createUnit(
  world: World,
  name: ObjectName,
  gx: number,
  gy: number,
  color: Color,
): Unit {
  const definition = getObjectDefinition(name);
  const tileset = getTileset(name);
  const collisionBox = tileset.collisionBox ?? DEFAULT_BOX;
  const position = worldFromGrid(gx, gy);
  const grid = gridFromWorld(position);
  const footprint = definition.skills.walk ? [] : footprintTiles(tileset, gx, gy);

  const unit: Unit = {
    id: nextId++,
    name,
    definition,
    tileset,
    position,
    grid,
    center: boxCenter(collisionBox),
    collisionBox,
    footprint,
    actions: [],
    animation: { name: "", direction: "NE", index: 0 },
    frame: 0,
    selected: false,
    color,
    carrying: { iron: 0 },
  };

  setAnimation(unit, tileset.defaultAnimation ?? "rest");
  advanceAnimation(unit);
  world.watch(grid, definition.communicationRadius);
  world.occupy(footprint, 1);
  return unit;
}

/**
 * Tiles a building on tile (gx, gy) covers: those whose centres fall inside its collision box
 * (the base of the sprite). Most buildings cover one tile; the Mind covers a cluster.
 */
export function footprintTiles(tileset: TilesetDefinition, gx: number, gy: number): GridRef[] {
  const box = tileset.collisionBox ?? DEFAULT_BOX;
  const halfWidth = (box.rx - box.lx) / 2;
  const halfHeight = (box.by - box.ty) / 2;
  const center = worldFromGrid(gx, gy);
  const reach = Math.ceil(halfWidth / 32) + Math.ceil(halfHeight / 16);

  const tiles: GridRef[] = [gridRef(gx, gy)];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (dx === 0 && dy === 0) continue;
      const point = worldFromGrid(gx + dx, gy + dy);
      if (Math.abs(point.x - center.x) < halfWidth && Math.abs(point.y - center.y) < halfHeight) {
        tiles.push(gridRef(gx + dx, gy + dy));
      }
    }
  }
  return tiles;
}

export function hasSkill(unit: Unit, skill: Skill): boolean {
  return unit.definition.skills[skill] === true;
}

function frames(unit: Unit): number[] {
  return unit.tileset.animations?.[unit.animation.name]?.[unit.animation.direction] ?? [0];
}

export function setAnimation(unit: Unit, name: string): void {
  if (unit.animation.name === name || !unit.tileset.animations?.[name]) return;
  unit.animation.name = name;
  unit.animation.index = 0;
}

export function setDirection(unit: Unit, direction: Direction): void {
  unit.animation.direction = direction;
}

export function advanceAnimation(unit: Unit): void {
  const list = frames(unit);
  if (unit.animation.index >= list.length) unit.animation.index = 0;
  unit.frame = list[unit.animation.index] ?? 0;
  unit.animation.index = (unit.animation.index + 1) % list.length;
}

/** Move a unit, keeping the fog of war in sync when it crosses into a new tile. */
export function moveBy(world: World, unit: Unit, dx: number, dy: number): void {
  unit.position.x += dx;
  unit.position.y += dy;

  const grid = gridFromWorld(unit.position);
  if (grid.x !== unit.grid.x || grid.y !== unit.grid.y) {
    world.unwatch(unit.grid, unit.definition.communicationRadius);
    world.watch(grid, unit.definition.communicationRadius);
    unit.grid = grid;
  }
}

function newWalk(target: Point): WalkAction {
  return {
    kind: "walk",
    target: { ...target },
    path: null,
    waitTicks: 0,
    repaths: 0,
    plannedAt: -1,
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

/** Half extents of a unit's collision box, centred on its position. */
function halfExtents(unit: Unit): Point {
  return {
    x: (unit.collisionBox.rx - unit.collisionBox.lx) / 2,
    y: (unit.collisionBox.by - unit.collisionBox.ty) / 2,
  };
}

/** Whether the collision box of `unit` contains `point`. */
export function unitContains(unit: Unit, point: Point): boolean {
  const half = halfExtents(unit);
  return (
    unit.position.x - half.x <= point.x &&
    point.x <= unit.position.x + half.x &&
    unit.position.y - half.y <= point.y &&
    point.y <= unit.position.y + half.y
  );
}

export function isMobile(unit: Unit): boolean {
  return hasSkill(unit, "walk");
}

function isWalking(unit: Unit): boolean {
  return unit.actions[0]?.kind === "walk";
}

const DIRECTIONS: Direction[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];

/** Screen-space compass direction of a movement vector. */
export function directionOf(dx: number, dy: number): Direction {
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return DIRECTIONS[(octant + 8) % 8] as Direction;
}

/** A mobile unit that stepping to `next` would bump into. Moving apart is always allowed. */
function blockingUnit(unit: Unit, next: Point, others: readonly Unit[]): Unit | undefined {
  const space = 2 * UNIT_RADIUS;
  return others.find((other) => {
    if (other === unit || !isMobile(other)) return false;
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
    const tile = gridFromWorld(candidate);
    const leavesTile = tile.x !== unit.grid.x || tile.y !== unit.grid.y;
    if (leavesTile && !world.isPassable(tile)) continue;
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
  action.path = findPath(world, unit.position, action.target, avoid ? { avoid } : {});
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

function walkTick(
  world: World,
  unit: Unit,
  action: WalkAction,
  others: readonly Unit[],
  budget: PathBudget,
): void {
  if (!action.path) {
    if (budget.remaining <= 0) return; // wait for a planning slot next tick
    budget.remaining--;
    plan(world, unit, action);
  } else if (action.plannedAt !== world.knownObstaclesVersion && budget.remaining > 0) {
    // The player learned of new obstacles (acid came into view, a building went up). Routes
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
  const step = Math.min(WALK_SPEED, distance);
  const next =
    distance === 0
      ? waypoint
      : {
          x: unit.position.x + (dx / distance) * step,
          y: unit.position.y + (dy / distance) * step,
        };

  // Safety net: never step onto ground that is actually blocked, known or not.
  const nextTile = gridFromWorld(next);
  if ((nextTile.x !== unit.grid.x || nextTile.y !== unit.grid.y) && !world.isPassable(nextTile)) {
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
        setDirection(unit, directionOf(swerve.x - unit.position.x, swerve.y - unit.position.y));
        moveBy(world, unit, swerve.x - unit.position.x, swerve.y - unit.position.y);
        return;
      }
      if (isWalking(blocker)) return;
    }
    replan(world, unit, action, new Set([tileKey(blocker.grid.x, blocker.grid.y)]));
    return;
  }
  action.waitTicks = 0;

  if (distance > 0) setDirection(unit, directionOf(dx, dy));
  moveBy(world, unit, next.x - unit.position.x, next.y - unit.position.y);

  if (distance <= WALK_SPEED) {
    // Snap exactly onto the waypoint so rounding can't leave the unit a hair short.
    unit.position.x = waypoint.x;
    unit.position.y = waypoint.y;
    action.path.shift();
    if (action.path.length === 0) unit.actions.shift();
  }
}

function gatherTick(world: World, unit: Unit, action: GatherAction): void {
  if (!action.resource.exists) {
    unit.actions.shift();
    return;
  }
  unit.carrying.iron += world.gather(action.resource, GATHER_RATE);
}

/** Advance one unit by one simulation tick. */
export function updateUnit(
  world: World,
  unit: Unit,
  others: readonly Unit[],
  budget: PathBudget = { remaining: Number.POSITIVE_INFINITY },
): void {
  advanceAnimation(unit);

  const action = unit.actions[0];
  if (!action) {
    setAnimation(unit, "rest");
    return;
  }

  setAnimation(unit, "walk");
  if (action.kind === "walk") walkTick(world, unit, action, others, budget);
  else gatherTick(world, unit, action);
}

/**
 * Units under a click (a point) or with their position inside a drag rectangle.
 */
export function findUnits(units: readonly Unit[], rect: Rect, isClick: boolean): Unit[] {
  if (isClick) {
    const point = { x: rect.left, y: rect.top };
    return units.filter((unit) => unitContains(unit, point));
  }
  return units.filter(
    (unit) =>
      rect.left <= unit.position.x &&
      unit.position.x <= rect.right &&
      rect.top <= unit.position.y &&
      unit.position.y <= rect.bottom,
  );
}
