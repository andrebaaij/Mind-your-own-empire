import {
  CLICK_TOLERANCE,
  PATHS_PER_TICK,
  SCROLL_SHIFT_MULTIPLIER,
  SCROLL_SPEED,
  STARTING_IRON,
} from "./config";
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
import { getObjectDefinition, getTileset, type ObjectName } from "./definitions";
import { assignSpots, findFreeSpots, tileKey } from "./pathfinding";
import { createNoise } from "./terrain";
import {
  type Color,
  cancelAllActions,
  cancelNextAction,
  createUnit,
  finalPosition,
  findUnits,
  footprintTiles,
  hasSkill,
  isMobile,
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

  const budget = { remaining: PATHS_PER_TICK };
  for (const unit of state.units) updateUnit(state.world, unit, state.units, budget);
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

/** Tiles an object placed on `tile` would cover. */
export function placementTiles(name: ObjectName, tile: GridRef): GridRef[] {
  return getObjectDefinition(name).skills.walk
    ? [tile]
    : footprintTiles(getTileset(name), tile.x, tile.y);
}

/** Whether `name` can be placed on `tile`: every covered tile explored and free to build on. */
export function canPlace(state: GameState, name: ObjectName, tile: GridRef): boolean {
  return placementTiles(name, tile).every((t) => state.world.isBuildable(t));
}

export interface BuildResult {
  built: number;
  /** Tiles skipped because something was in the way. */
  blocked: number;
  /** True when iron ran out before every tile was built. */
  outOfIron: boolean;
}

/**
 * Place `name` on every free tile of the drag area, as far as iron allows. Tiles that are
 * unexplored or blocked by buildings or acid are skipped, as when dragging walls in AoE.
 */
export function build(state: GameState, name: ObjectName, tiles: readonly GridRef[]): BuildResult {
  const cost = getObjectDefinition(name).cost?.iron ?? 0;
  const result: BuildResult = { built: 0, blocked: 0, outOfIron: false };
  for (const tile of tiles) {
    if (!canPlace(state, name, tile)) {
      result.blocked++;
      continue;
    }
    if (state.economy.iron < cost) {
      result.outOfIron = true;
      break;
    }
    state.economy.iron -= cost;
    const placed = spawn(state, name, tile.x, tile.y);
    clearFootprint(state, placed.footprint);
    result.built++;
  }
  return result;
}

/** Send mobile units standing where a building just went up to the nearest open ground. */
function clearFootprint(state: GameState, footprint: readonly GridRef[]): void {
  if (footprint.length === 0) return;
  const covered = new Set(footprint.map((t) => tileKey(t.x, t.y)));
  const trapped = state.units.filter(
    (u) => isMobile(u) && covered.has(tileKey(u.grid.x, u.grid.y)),
  );
  if (trapped.length === 0) return;

  const spots = findFreeSpots(state.world, trapped[0]?.position ?? { x: 0, y: 0 }, trapped.length);
  const assigned = assignSpots(
    trapped.map((unit) => ({ item: unit, from: unit.position })),
    spots,
  );
  for (const [unit, spot] of assigned) {
    cancelAllActions(unit);
    queueWalk(unit, spot);
  }
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
 * Right-click order for the selection: gatherers mine the iron in the rectangle; if nobody can
 * gather there, walkers spread out around the pointer. A plain order replaces what the units
 * were doing; with `queue` (Shift held) it is added after their current orders.
 */
export function issueOrder(state: GameState, rect: Rect, target: Point, queue = false): void {
  if (state.selection.length === 0) return;

  const resources = resourcesInRect(state.world, rect);
  const gatherers = state.selection.filter((unit) => hasSkill(unit, "gather"));

  if (resources.length > 0 && gatherers.length > 0) {
    if (!queue) for (const unit of gatherers) cancelAllActions(unit);
    orderGather(gatherers, resources);
    return;
  }

  const walkers = state.selection.filter((unit) => hasSkill(unit, "walk"));
  if (!queue) for (const unit of walkers) cancelAllActions(unit);
  orderMove(state.world, walkers, target);
}

/**
 * Give each walker its own spot around the target, so a group fans out instead of fighting
 * over one point. Spots go to the nearest walkers first.
 */
function orderMove(world: World, walkers: readonly Unit[], target: Point): void {
  const spots = findFreeSpots(world, target, walkers.length);
  const assigned = assignSpots(
    walkers.map((unit) => ({ item: unit, from: finalPosition(unit) })),
    spots,
  );
  for (const unit of walkers) queueWalk(unit, assigned.get(unit) ?? target);
}

/**
 * Spread gatherers over the iron in the area: each starts at a different tile where possible
 * (the nearest one still free), then works through the rest nearest-first.
 */
function orderGather(gatherers: readonly Unit[], resources: readonly Resource[]): void {
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const firsts = assignSpots(
    gatherers.map((unit) => ({ item: unit, from: finalPosition(unit) })),
    resources.map((r) => r.position),
  );

  for (const unit of gatherers) {
    const first = firsts.get(unit);
    const start =
      resources.find((r) => r.position === first) ??
      [...resources].sort(
        (a, b) =>
          distance(a.position, finalPosition(unit)) - distance(b.position, finalPosition(unit)),
      )[0];
    if (!start) continue;

    // Nearest-neighbour tour from the first tile.
    const todo = resources.filter((r) => r !== start);
    let current = start;
    queueGather(unit, current);
    while (todo.length > 0) {
      todo.sort(
        (a, b) => distance(a.position, current.position) - distance(b.position, current.position),
      );
      current = todo.shift() as Resource;
      queueGather(unit, current);
    }
  }
}

export function cancelOrders(state: GameState, all: boolean): void {
  for (const unit of state.selection) {
    if (all) cancelAllActions(unit);
    else cancelNextAction(unit);
  }
}
