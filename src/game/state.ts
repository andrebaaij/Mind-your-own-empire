import {
  MAX_BUILD_SLOPE,
  PATHS_PER_TICK,
  ROTATE_SPEED,
  SCROLL_SHIFT_MULTIPLIER,
  SCROLL_SPEED,
  STARTING_IRON,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./config";
import { type GridRef, gridFromWorld, gridRange, type Point } from "./coords";
import { getObjectDefinition, type ObjectName } from "./definitions";
import { assignSpots, findFreeSpots, tileKey } from "./pathfinding";
import { createNoise, noiseTerrain } from "./terrain";
import {
  type Color,
  cancelAllActions,
  cancelNextAction,
  createUnit,
  finalPosition,
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
  /** Ground position under the pointer, or null when it points at the sky. */
  world: Point | null;
  /** Ground position where the current drag started, if a button is held. */
  dragStart: Point | null;
}

/** An orbiting RTS camera: looks at `target` on the ground from `distance` away. */
export interface Camera {
  target: Point;
  /** Rotation around the vertical axis, in radians. π/4 matches the old isometric view. */
  yaw: number;
  distance: number;
}

export interface CameraKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  fast: boolean;
}

export interface GameState {
  world: World;
  player: Player;
  units: Unit[];
  economy: Economy;
  camera: Camera;
  /** Object being placed, or null when not in build mode. */
  building: ObjectName | null;
  selection: Unit[];
  pointer: Pointer;
  /** Currently held camera keys. */
  keys: CameraKeys;
  paused: boolean;
}

export function createGame(options: { seed: string; player: Player }): GameState {
  const state: GameState = {
    world: new World(noiseTerrain(createNoise(options.seed))),
    player: options.player,
    units: [],
    economy: { iron: STARTING_IRON, energyPerHour: 0, storage: { iron: 0, energy: 0 } },
    camera: { target: { x: 0, y: 0 }, yaw: Math.PI / 4, distance: ZOOM_DEFAULT },
    building: null,
    selection: [],
    pointer: { world: null, dragStart: null },
    keys: noKeys(),
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

  const mind = state.units.find((unit) => unit.name === "mind");
  if (mind) state.camera.target = { ...mind.position };
  return state;
}

export function noKeys(): CameraKeys {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    rotateLeft: false,
    rotateRight: false,
    fast: false,
  };
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

  moveCamera(state.camera, state.keys);

  const budget = { remaining: PATHS_PER_TICK };
  for (const unit of state.units) updateUnit(state.world, unit, state.units, budget);
}

/** Pan and rotate the camera for one tick of held keys. Panning is relative to the view. */
export function moveCamera(camera: Camera, keys: CameraKeys): void {
  if (keys.rotateLeft) camera.yaw -= ROTATE_SPEED;
  if (keys.rotateRight) camera.yaw += ROTATE_SPEED;

  let forward = 0;
  let right = 0;
  if (keys.up) forward += 1;
  if (keys.down) forward -= 1;
  if (keys.right) right += 1;
  if (keys.left) right -= 1;
  if (forward === 0 && right === 0) return;

  // Pan faster when zoomed out, so the screen moves at a similar pace.
  let speed = SCROLL_SPEED * (camera.distance / ZOOM_DEFAULT);
  if (keys.fast) speed *= SCROLL_SHIFT_MULTIPLIER;
  const sin = Math.sin(camera.yaw);
  const cos = Math.cos(camera.yaw);
  camera.target.x += (-sin * forward + cos * right) * speed;
  camera.target.y += (-cos * forward - sin * right) * speed;
}

export function zoomCamera(camera: Camera, factor: number): void {
  camera.distance = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, camera.distance * factor));
}

/** Tiles covered by the current build preview. */
export function buildTiles(pointer: Pointer): GridRef[] {
  if (!pointer.world) return [];
  return gridRange(gridFromWorld(pointer.dragStart ?? pointer.world), gridFromWorld(pointer.world));
}

/** Tiles an object placed on `tile` would cover. */
export function placementTiles(name: ObjectName, tile: GridRef): GridRef[] {
  const definition = getObjectDefinition(name);
  return definition.skills.walk ? [tile] : footprintTiles(definition, tile.x, tile.y);
}

/**
 * Whether `name` can be placed on `tile`: every covered tile explored and free to build on,
 * and the ground under a building level enough.
 */
export function canPlace(state: GameState, name: ObjectName, tile: GridRef): boolean {
  const tiles = placementTiles(name, tile);
  if (!tiles.every((t) => state.world.isBuildable(t))) return false;
  const heights = tiles.map((t) => state.world.tileHeight(t));
  return Math.max(...heights) - Math.min(...heights) <= MAX_BUILD_SLOPE;
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

/**
 * Right-click order for the selection: gatherers mine the given iron; if there is none or
 * nobody can gather, mobile units spread out around `target`. A plain order replaces what
 * the units were doing; with `queue` (Shift held) it is added after their current orders.
 */
export function issueOrder(
  state: GameState,
  target: Point,
  resources: readonly Resource[] = [],
  queue = false,
): void {
  if (state.selection.length === 0) return;

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
