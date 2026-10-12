import alea from "alea";
import {
  BROWNOUT_FACTOR,
  DELIVERY_RANGE,
  MAX_BUILD_SLOPE,
  PATHS_PER_TICK,
  ROTATE_SPEED,
  SCROLL_SHIFT_MULTIPLIER,
  SCROLL_SPEED,
  STARTING_IRON,
  TICK_RATE,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./config";
import { distance, type GridRef, gridFromWorld, gridRange, type Point } from "./coords";
import { custodyThink, tidyTick } from "./custody";
import { type Faction, getObjectDefinition, type ObjectName } from "./definitions";
import { emit, type GameEvent } from "./events";
import type { MissionRuntime } from "./missions";
import { assignSpots, findFreeSpots, tileKey } from "./pathfinding";
import { orderStudy, relicsThink, studyTick } from "./relics";
import type { Site, SiteKind, SiteSpec } from "./sites";
import { idiranThink, type Search } from "./stealth";
import { createNoise, noiseTerrain } from "./terrain";
import {
  type Color,
  cancelAllActions,
  cancelNextAction,
  createUnit,
  destroyUnit,
  finalPosition,
  footprintTiles,
  hasSkill,
  isMobile,
  queueGather,
  queueWalk,
  type Unit,
  type UnitContext,
  updateUnit,
} from "./units";
import { type Resource, type ResourceKind, World } from "./world";

export interface Player {
  name: string;
  color: Color;
}

export interface Economy {
  iron: number;
  /** The Tessilend's building crystal, mined from seams around their sites. */
  lattice: number;
  /** Net power: what everything produces minus what it uses. Below zero, drones slow down. */
  power: number;
  storage: Record<ResourceKind, number>;
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

/** Something the Mind says, shown to the player. */
export interface Message {
  text: string;
  tone: "info" | "warning" | "success";
}

export interface Stats {
  ironDelivered: number;
  latticeDelivered: number;
  /** Tessilend sites studied (and woken), by kind. */
  studied: Partial<Record<SiteKind, number>>;
  built: Partial<Record<ObjectName, number>>;
  /** Player buildings the Custody dismantled. */
  tidied: number;
  /** Decoy beacons the Idirans found (and smashed). */
  decoysFound: number;
  /** Idiran camps the Custody dismantled. */
  evicted: number;
  /** Landing pads the Idirans wrecked. */
  padsLost: number;
  /** Idiran skimmers the wardens saw off the planet. */
  escorted: number;
  /** Refugee ships safely down. */
  landed: number;
}

export interface GameState {
  /** The seed the world was made from. */
  seed: string;
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
  /** Simulation ticks so far. */
  ticks: number;
  /** Seeded randomness for the simulation, so a seed always plays out the same way. */
  random: () => number;
  /** Lines waiting to be shown; the HUD takes them from here. */
  messages: Message[];
  /** Keys of one-off messages already said. */
  said: Set<string>;
  stats: Stats;
  /** Whether wardens dismantle unattended buildings yet, or only look around. */
  custodyTidying: boolean;
  mission: MissionRuntime | null;
  /** Designs learned from Tessilend fabrication beds, buildable on top of the basics. */
  designs: Set<ObjectName>;
  /** Things the player has come across, e.g. "lattice"; the HUD shows what's been found. */
  discovered: Set<string>;
  /** Tessilend sites brought back to life. */
  awake: Site[];
  /** The site the player last clicked, shown in the selection panel. */
  inspecting: Site | null;
  /** Running silent: everything at half speed, and much harder for the Idirans to detect. */
  silent: boolean;
  /** How sure the Idirans are of where the Mind is, from 0 to 100 (found). */
  suspicion: number;
  /** Where the Idirans last picked something up. */
  lastContact: Point | null;
  /** The Idiran search, once they're here. */
  search: Search | null;
  /** Story flags: "key" (the pod's sealed key), "tenancy" (proof the habitats are for guests)… */
  flags: Set<string>;
  /** Whether the Custody has sided with the Mind: wardens see Idirans off instead of tidying. */
  custodyAllied: boolean;
  /** What happened since the last frame, for effects and sound. */
  events: GameEvent[];
}

export type StartLayout = [ObjectName, number, number][];

/** Free play: the old 2014 starting base, with power to spare. */
export const SANDBOX_LAYOUT: StartLayout = [
  ["block", 0, 1],
  ["block", 1, 1],
  ["block", 2, 1],
  ["mind", 5, 5],
  ["tower", 10, 10],
  ["solar", 11, 4],
  ["solar", 11, 5],
  ["solar", 10, 4],
  ["solar", 10, 5],
  ["scout", 0, 0],
];

export function createGame(options: {
  seed: string;
  player: Player;
  layout?: StartLayout;
  iron?: number;
  /** Tessilend sites to place by hand, on top of the generated ones. */
  sites?: readonly SiteSpec[];
}): GameState {
  const state: GameState = {
    seed: options.seed,
    world: new World(noiseTerrain(createNoise(options.seed)), options.sites),
    player: options.player,
    units: [],
    economy: {
      iron: options.iron ?? STARTING_IRON,
      lattice: 0,
      power: 0,
      storage: { iron: 0, lattice: 0 },
    },
    camera: { target: { x: 0, y: 0 }, yaw: Math.PI / 4, distance: ZOOM_DEFAULT },
    building: null,
    selection: [],
    pointer: { world: null, dragStart: null },
    keys: noKeys(),
    paused: false,
    ticks: 0,
    random: alea(`${options.seed}:sim`),
    messages: [],
    said: new Set(),
    stats: {
      ironDelivered: 0,
      latticeDelivered: 0,
      studied: {},
      built: {},
      tidied: 0,
      decoysFound: 0,
      evicted: 0,
      padsLost: 0,
      escorted: 0,
      landed: 0,
    },
    custodyTidying: true,
    mission: null,
    designs: new Set(),
    discovered: new Set(),
    awake: [],
    inspecting: null,
    silent: false,
    suspicion: 0,
    lastContact: null,
    search: null,
    flags: new Set(),
    custodyAllied: false,
    events: [],
  };

  for (const [name, x, y] of options.layout ?? SANDBOX_LAYOUT) spawn(state, name, x, y);

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

/** Queue a line from the Mind. With `once`, a line with that key is only ever said once. */
export function say(
  state: GameState,
  text: string,
  tone: Message["tone"] = "info",
  options: { once?: string } = {},
): void {
  if (options.once) {
    if (state.said.has(options.once)) return;
    state.said.add(options.once);
  }
  state.messages.push({ text, tone });
  emit(state, { kind: "said", tone });
}

export function spawn(
  state: GameState,
  name: ObjectName,
  gx: number,
  gy: number,
  faction: Faction = "player",
): Unit {
  const unit = createUnit(state.world, name, gx, gy, state.player.color, faction);
  if (faction === "player") {
    state.economy.power += unit.definition.energy;
    state.economy.storage.iron += unit.definition.storage.iron;
    state.economy.storage.lattice += unit.definition.storage.lattice ?? 0;
  }
  state.units.push(unit);
  return unit;
}

/** Remove a unit from the game, undoing what it added to the economy. */
export function removeUnit(
  state: GameState,
  unit: Unit,
  why?: Extract<GameEvent, { kind: "removed" }>["why"],
): void {
  const index = state.units.indexOf(unit);
  if (index === -1) return;
  if (why) emit(state, { kind: "removed", at: { ...unit.position }, name: unit.name, why });
  state.units.splice(index, 1);
  destroyUnit(state.world, unit);
  if (unit.faction === "player") {
    state.economy.power -= unit.definition.energy;
    state.economy.storage.iron -= unit.definition.storage.iron;
    state.economy.storage.lattice -= unit.definition.storage.lattice ?? 0;
    state.economy.iron = Math.min(state.economy.iron, state.economy.storage.iron);
    state.economy.lattice = Math.min(state.economy.lattice, state.economy.storage.lattice);
  }
  if (unit.selected)
    setSelection(
      state,
      state.selection.filter((u) => u !== unit),
    );
}

/** The nearest building that takes deliveries (the Mind). */
function nearestStore(state: GameState, from: Point): Unit | undefined {
  let best: Unit | undefined;
  for (const unit of state.units) {
    if (unit.faction !== "player" || unit.definition.storage.iron <= 0) continue;
    if (!best || distance(unit.position, from) < distance(best.position, from)) best = unit;
  }
  return best;
}

/** How fast the player's machines work: halved by a power shortage, and again by running silent. */
export function workRate(state: GameState): number {
  return (state.economy.power < 0 ? BROWNOUT_FACTOR : 1) * (state.silent ? 0.5 : 1);
}

function unitContext(state: GameState): UnitContext {
  return {
    budget: { remaining: PATHS_PER_TICK },
    power: (unit) => (unit.faction === "player" ? workRate(state) : 1),
    dropOff: (unit) => {
      const store = nearestStore(state, unit.position);
      return store ? { ...store.position } : null;
    },
    deposit: (unit, kind, amount) => {
      const store = nearestStore(state, unit.position);
      if (!store) return 0;
      const reach = (store.definition.footprint ?? 1) / 2 + DELIVERY_RANGE;
      if (distance(store.position, unit.position) > reach) return 0;
      const accepted = Math.max(
        0,
        Math.min(amount, state.economy.storage[kind] - state.economy[kind]),
      );
      state.economy[kind] += accepted;
      if (accepted > 0)
        emit(state, {
          kind: "delivered",
          at: { ...store.position },
          resource: kind,
          amount: accepted,
        });
      if (kind === "iron") state.stats.ironDelivered += accepted;
      else state.stats.latticeDelivered += accepted;
      if (accepted > 0 && kind === "lattice") state.discovered.add("lattice");
      if (accepted < amount) {
        say(
          state,
          kind === "iron"
            ? "The store is full. Build nothing, or build something; just not more bloom."
            : "No room for more lattice. It's precious, not plentiful; spend some.",
          "warning",
          {
            once: `store-full-${Math.floor(state.ticks / (TICK_RATE * 30))}`,
          },
        );
      }
      return accepted;
    },
    tidy: (unit, action) => tidyTick(state, unit, action),
    mined: (unit, kind) => emit(state, { kind: "mined", at: { ...unit.position }, resource: kind }),
    study: (unit, action) => studyTick(state, unit, action),
  };
}

/** Advance the simulation by one tick. */
export function tick(state: GameState): void {
  if (state.paused) return;
  state.ticks++;

  moveCamera(state.camera, state.keys);

  const ctx = unitContext(state);
  for (const unit of [...state.units]) {
    if (state.units.includes(unit)) updateUnit(state.world, unit, state.units, ctx);
  }
  if (state.ticks % 10 === 0) custodyThink(state);
  if (state.ticks % TICK_RATE === 0) relicsThink(state, 1);
  if (state.ticks % 10 === 0) idiranThink(state, 10 / TICK_RATE);
  watchPower(state);
}

/** Tell the player when power runs short, and when it's back. */
function watchPower(state: GameState): void {
  const short = state.economy.power < 0;
  if (short && !state.said.has("brownout")) {
    state.said.add("brownout");
    say(
      state,
      "Power's short, so everything runs at half speed. A collector or two would help.",
      "warning",
    );
  } else if (!short && state.said.has("brownout")) {
    state.said.delete("brownout");
    say(state, "Power restored. Everyone back to full speed.", "success");
  }
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
  /** The resource that ran out before every tile was built, if one did. */
  shortOf: ResourceKind | null;
}

/** Whether the player knows how to build `name`: the basics, or a design they've learned. */
export function canBuild(state: GameState, name: ObjectName): boolean {
  return BASIC_DESIGNS.includes(name) || state.designs.has(name);
}

const BASIC_DESIGNS: readonly ObjectName[] = ["block", "solar", "tower"];

/** What the player is short of to afford `name`, if anything. */
export function shortfall(state: GameState, name: ObjectName): ResourceKind | null {
  const cost = getObjectDefinition(name).cost ?? {};
  if (state.economy.iron < (cost.iron ?? 0)) return "iron";
  if (state.economy.lattice < (cost.lattice ?? 0)) return "lattice";
  return null;
}

/**
 * Place `name` on every free tile of the drag area, as far as iron allows. Tiles that are
 * unexplored or blocked by buildings or acid are skipped, as when dragging walls in AoE.
 */
export function build(state: GameState, name: ObjectName, tiles: readonly GridRef[]): BuildResult {
  const cost = getObjectDefinition(name).cost ?? {};
  const result: BuildResult = { built: 0, blocked: 0, shortOf: null };
  if (!canBuild(state, name)) return result;
  for (const tile of tiles) {
    if (!canPlace(state, name, tile)) {
      result.blocked++;
      continue;
    }
    result.shortOf = shortfall(state, name);
    if (result.shortOf) break;
    state.economy.iron -= cost.iron ?? 0;
    state.economy.lattice -= cost.lattice ?? 0;
    const placed = spawn(state, name, tile.x, tile.y);
    emit(state, { kind: "built", at: { ...placed.position }, name });
    state.stats.built[name] = (state.stats.built[name] ?? 0) + 1;
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
  if (units.length > 0) emit(state, { kind: "selected", count: units.length });
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
  // Right-clicking a Tessilend site sets worker drones studying it.
  const tile = gridFromWorld(target);
  const site = state.world.isExplored(tile) ? state.world.siteAt(tile) : undefined;
  if (site && gatherers.length > 0) {
    emit(state, { kind: "ordered", at: { ...site.center }, order: "study" });
    orderStudy(state, gatherers, site, queue);
    return;
  }
  if (resources.length > 0 && gatherers.length > 0) {
    emit(state, { kind: "ordered", at: { ...target }, order: "gather" });
    if (!queue) for (const unit of gatherers) cancelAllActions(unit);
    orderGather(gatherers, resources);
    return;
  }

  const walkers = state.selection.filter((unit) => hasSkill(unit, "walk"));
  if (walkers.length > 0) emit(state, { kind: "ordered", at: { ...target }, order: "move" });
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
