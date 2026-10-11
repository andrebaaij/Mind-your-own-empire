import { COLLISION_LOOKAHEAD, GATHER_RATE, WALK_SPEED } from "./config";
import { type GridRef, gridFromWorld, type Point, type Rect, worldFromGrid } from "./coords";
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
  /** Per-tick movement towards the target. */
  step: Point;
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

  const unit: Unit = {
    id: nextId++,
    name,
    definition,
    tileset,
    position,
    grid,
    center: boxCenter(collisionBox),
    collisionBox,
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
  return unit;
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

export function stepTowards(origin: Point, target: Point): Point {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: 0, y: 0 };
  return { x: (dx / distance) * WALK_SPEED, y: (dy / distance) * WALK_SPEED };
}

/** Queue a walk to `target`, starting from wherever the previous queued action ends. */
export function queueWalk(unit: Unit, target: Point): void {
  const origin = unit.actions.at(-1)?.target ?? unit.position;
  unit.actions.push({
    kind: "walk",
    target: { ...target },
    step: stepTowards(origin, target),
  });
}

export function queueGather(unit: Unit, resource: Resource): void {
  queueWalk(unit, resource.position);
  unit.actions.push({ kind: "gather", target: { ...resource.position }, resource });
}

/** Remove the next action. A walk leading to another action is removed together with it. */
export function cancelNextAction(unit: Unit): void {
  const [first, second] = unit.actions;
  if (first?.kind === "walk" && second && second.kind !== "walk") {
    unit.actions.splice(0, 2);
  } else {
    unit.actions.splice(0, 1);
  }
  const next = unit.actions[0];
  if (next?.kind === "walk") next.step = stepTowards(unit.position, next.target);
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

/** Whether moving `unit` repeatedly by (dx, dy) would run into another unit soon. */
function isPathBlocked(unit: Unit, others: readonly Unit[], dx: number, dy: number): boolean {
  for (const other of others) {
    if (other === unit) continue;
    for (let i = 1; i <= COLLISION_LOOKAHEAD; i++) {
      if (unitContains(other, { x: unit.position.x + dx * i, y: unit.position.y + dy * i })) {
        return true;
      }
    }
  }
  return false;
}

function walkTick(world: World, unit: Unit, action: WalkAction, others: readonly Unit[]): void {
  setDirection(unit, "N");

  let dx = action.target.x - unit.position.x;
  let dy = action.target.y - unit.position.y;
  if (Math.abs(dx) > Math.abs(action.step.x)) dx = action.step.x;
  if (Math.abs(dy) > Math.abs(action.step.y)) dy = action.step.y;

  if (dx === 0 && dy === 0) {
    unit.actions.shift();
    return;
  }

  if (!isPathBlocked(unit, others, dx, dy)) {
    moveBy(world, unit, dx, dy);
  } else {
    // Sweep alternately left and right of the intended heading for a free direction.
    const length = Math.hypot(dx, dy);
    let degrees = Math.asin(dy / length) * (180 / Math.PI);
    if (dx < 0) degrees = 180 - degrees;

    for (let j = 1; j < 180; j++) {
      degrees += j * (2 * (j % 2) - 1);
      const ax = Math.cos((degrees * Math.PI) / 180) * length;
      const ay = Math.sin((degrees * Math.PI) / 180) * length;
      if (!isPathBlocked(unit, others, ax, ay)) {
        moveBy(world, unit, ax, ay);
        action.step = stepTowards(unit.position, action.target);
        break;
      }
    }
    // Fully boxed in: wait for the way to clear.
  }

  // Snap on arrival so floating-point drift can't leave a unit a hair short forever.
  const remaining = Math.hypot(
    action.target.x - unit.position.x,
    action.target.y - unit.position.y,
  );
  if (remaining < 1e-6) {
    unit.position.x = action.target.x;
    unit.position.y = action.target.y;
    unit.actions.shift();
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
export function updateUnit(world: World, unit: Unit, others: readonly Unit[]): void {
  advanceAnimation(unit);

  const action = unit.actions[0];
  if (!action) {
    setAnimation(unit, "rest");
    return;
  }

  setAnimation(unit, "walk");
  if (action.kind === "walk") walkTick(world, unit, action, others);
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
