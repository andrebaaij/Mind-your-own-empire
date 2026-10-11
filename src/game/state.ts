import { CLICK_TOLERANCE, SCROLL_SHIFT_MULTIPLIER, SCROLL_SPEED, STARTING_IRON } from "./config";
import {
  type GridRef,
  gridFromWorld,
  gridRange,
  gridRef,
  type Point,
  type Rect,
  rectContains,
  rectFromPoints,
} from "./coords";
import { getObjectDefinition, type ObjectName } from "./definitions";
import { createNoise } from "./terrain";
import {
  type Color,
  cancelAllActions,
  cancelNextAction,
  createUnit,
  findUnits,
  hasSkill,
  queueGather,
  queueWalk,
  type Unit,
  updateUnit,
} from "./units";
import { type Resource, World } from "./world";

export interface Player {
  name: string;
  color: Color;
}

export interface Economy {
  iron: number;
  /** Net energy production per hour across all objects. */
  energyPerHour: number;
  storage: { iron: number; energy: number };
}

export interface Pointer {
  /** World position of the pointer. */
  world: Point;
  /** World position where the current drag started, if a button is held. */
  dragStart: Point | null;
}

export interface GameState {
  world: World;
  player: Player;
  units: Unit[];
  economy: Economy;
  /** Camera offset: world position (0, 0) is drawn at this screen position. */
  camera: Point;
  /** Object being placed, or null when not in build mode. */
  building: ObjectName | null;
  selection: Unit[];
  pointer: Pointer;
  /** Currently held movement keys. */
  scroll: { up: boolean; down: boolean; left: boolean; right: boolean; fast: boolean };
  paused: boolean;
}

export function createGame(options: { seed: string; player: Player }): GameState {
  const state: GameState = {
    world: new World(createNoise(options.seed)),
    player: options.player,
    units: [],
    economy: { iron: STARTING_IRON, energyPerHour: 0, storage: { iron: 0, energy: 0 } },
    camera: { x: 0, y: 0 },
    building: null,
    selection: [],
    pointer: { world: { x: 0, y: 0 }, dragStart: null },
    scroll: { up: false, down: false, left: false, right: false, fast: false },
    paused: false,
  };

  const start: [ObjectName, number, number][] = [
    ["block", 0, 1],
    ["block", 1, 1],
    ["block", 2, 1],
    ["mind", 5, 5],
    ["tower", 10, 10],
    ["solar", 11, 4],
    ["solar", 11, 5],
    ["solar", 11, 6],
    ["solar", 10, 4],
    ["solar", 10, 5],
    ["solar", 10, 6],
    ["scout", 0, 0],
  ];
  for (const [name, x, y] of start) spawn(state, name, x, y);

  return state;
}

export function spawn(state: GameState, name: ObjectName, gx: number, gy: number): Unit {
  const unit = createUnit(state.world, name, gx, gy, state.player.color);
  const { energy, storage } = unit.definition;
  state.economy.energyPerHour += energy;
  state.economy.storage.energy += storage.energy;
  state.economy.storage.iron += storage.iron;
  state.units.push(unit);
  return unit;
}

/** Advance the simulation by one tick. */
export function tick(state: GameState): void {
  if (state.paused) return;

  const { scroll } = state;
  let dx = 0;
  let dy = 0;
  if (scroll.up) dy += SCROLL_SPEED;
  if (scroll.down) dy -= SCROLL_SPEED;
  if (scroll.left) dx += SCROLL_SPEED;
  if (scroll.right) dx -= SCROLL_SPEED;
  if (scroll.fast) {
    dx *= SCROLL_SHIFT_MULTIPLIER;
    dy *= SCROLL_SHIFT_MULTIPLIER;
  }
  if (dx !== 0 || dy !== 0) {
    state.camera.x += dx;
    state.camera.y += dy;
    // The pointer stays put on screen, so it moves through the world.
    state.pointer.world.x -= dx;
    state.pointer.world.y -= dy;
  }

  for (const unit of state.units) updateUnit(state.world, unit, state.units);
}

/** The rectangle being dragged, or the pointer position as a zero-size rectangle. */
export function selectionRect(pointer: Pointer): Rect {
  return rectFromPoints(pointer.dragStart ?? pointer.world, pointer.world);
}

export function isClick(rect: Rect): boolean {
  return rect.right - rect.left < CLICK_TOLERANCE && rect.bottom - rect.top < CLICK_TOLERANCE;
}

/** Tiles covered by the current build preview. */
export function buildTiles(pointer: Pointer): GridRef[] {
  return gridRange(gridFromWorld(pointer.dragStart ?? pointer.world), gridFromWorld(pointer.world));
}

export interface BuildResult {
  built: number;
  /** True when iron ran out before every tile was built. */
  outOfIron: boolean;
}

/** Place the selected building on every tile of the drag rectangle, as far as iron allows. */
export function build(state: GameState, name: ObjectName, tiles: readonly GridRef[]): BuildResult {
  const cost = getObjectDefinition(name).cost?.iron ?? 0;
  let built = 0;
  for (const tile of tiles) {
    if (state.economy.iron < cost) return { built, outOfIron: true };
    state.economy.iron -= cost;
    spawn(state, name, tile.x, tile.y);
    built++;
  }
  return { built, outOfIron: false };
}

export function setSelection(state: GameState, units: Unit[]): void {
  for (const unit of state.selection) unit.selected = false;
  state.selection = units;
  for (const unit of units) unit.selected = true;
}

export function selectInRect(state: GameState, rect: Rect): void {
  setSelection(state, findUnits(state.units, rect, isClick(rect)));
}

/** Explored resources under a click or within a drag rectangle. */
export function resourcesInRect(world: World, rect: Rect): Resource[] {
  if (isClick(rect)) {
    const resource = world.resourceAt(gridFromWorld({ x: rect.left, y: rect.top }));
    return resource ? [resource] : [];
  }

  const corners = [
    gridFromWorld({ x: rect.left, y: rect.top }),
    gridFromWorld({ x: rect.right, y: rect.top }),
    gridFromWorld({ x: rect.left, y: rect.bottom }),
    gridFromWorld({ x: rect.right, y: rect.bottom }),
  ];
  const min = { x: Math.min(...corners.map((c) => c.x)), y: Math.min(...corners.map((c) => c.y)) };
  const max = { x: Math.max(...corners.map((c) => c.x)), y: Math.max(...corners.map((c) => c.y)) };

  const found: Resource[] = [];
  for (const tile of gridRange(gridRef(min.x, min.y), gridRef(max.x, max.y))) {
    const resource = world.resourceAt(tile);
    if (resource && rectContains(rect, resource.position)) found.push(resource);
  }
  return found;
}

/**
 * Right-click order for the selection: gatherers mine every resource in the rectangle;
 * if nobody can gather there, walkers move to the pointer.
 */
export function issueOrder(state: GameState, rect: Rect, target: Point): void {
  if (state.selection.length === 0) return;

  const resources = resourcesInRect(state.world, rect);
  const gatherers = state.selection.filter((unit) => hasSkill(unit, "gather"));

  if (resources.length > 0 && gatherers.length > 0) {
    for (const unit of gatherers) {
      for (const resource of resources) queueGather(unit, resource);
    }
    return;
  }

  for (const unit of state.selection) {
    if (hasSkill(unit, "walk")) queueWalk(unit, target);
  }
}

export function cancelOrders(state: GameState, all: boolean): void {
  for (const unit of state.selection) {
    if (all) cancelAllActions(unit);
    else cancelNextAction(unit);
  }
}
