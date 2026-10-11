/**
 * Long-range path planning on the tile grid, in the style of Age of Empires: A* over tile
 * passability (terrain and buildings), "as close as possible" when the goal can't be reached,
 * string-pulled into straight segments, plus destination spreading for group moves.
 * Unit-versus-unit avoidance is handled separately, at movement time, in `units.ts`.
 */
import { HEURISTIC_WEIGHT, LOS_SAMPLE_STEP, MAX_PATH_NODES, UNIT_RADIUS } from "./config";
import { type GridRef, gridFromWorld, gridRef, type Point, worldFromGrid } from "./coords";
import type { World } from "./world";

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export interface PathOptions {
  /** Extra tiles to treat as blocked (keys from `tileKey`), e.g. where idle units stand. */
  avoid?: ReadonlySet<string>;
  /** Search budget; when exhausted the path leads to the closest tile found so far. */
  maxNodes?: number;
}

function passable(world: World, x: number, y: number, avoid?: ReadonlySet<string>): boolean {
  return world.isPassable(gridRef(x, y)) && !avoid?.has(tileKey(x, y));
}

/** Neighbour steps with their cost: the world-space length of the step (iso tiles aren't square). */
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
].map(([dx = 0, dy = 0]) => {
  const a = worldFromGrid(0, 0);
  const b = worldFromGrid(dx, dy);
  return { dx, dy, cost: Math.hypot(b.x - a.x, b.y - a.y) };
});

/** Compact numeric key for a tile, cheaper than strings in the hot loop. */
function nodeKey(x: number, y: number): number {
  return (x + 0x8000) * 0x10000 + (y + 0x8000);
}

function worldDistance(ax: number, ay: number, bx: number, by: number): number {
  const a = worldFromGrid(ax, ay);
  const b = worldFromGrid(bx, by);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  parent: Node | null;
  closed: boolean;
}

/** Binary min-heap keyed on f = g + h, ties broken towards the goal (lower h). */
class OpenSet {
  private readonly heap: Node[] = [];

  get size(): number {
    return this.heap.length;
  }

  private less(a: Node, b: Node): boolean {
    const fa = a.g + a.h;
    const fb = b.g + b.h;
    return fa < fb || (fa === fb && a.h < b.h);
  }

  push(node: Node): void {
    const heap = this.heap;
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = heap[parent] as Node;
      if (!this.less(node, p)) break;
      heap[i] = p;
      i = parent;
    }
    heap[i] = node;
  }

  pop(): Node | undefined {
    const heap = this.heap;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length === 0 || !last) return top;

    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = last;
      let index = i;
      const l = heap[left];
      const r = heap[right];
      if (l && this.less(l, smallest)) {
        smallest = l;
        index = left;
      }
      if (r && this.less(r, smallest)) {
        smallest = r;
        index = right;
      }
      if (index === i) break;
      heap[i] = smallest;
      i = index;
    }
    heap[i] = last;
    return top;
  }
}

/**
 * A* from `start` to `goal` over passable tiles, 8-connected without cutting corners.
 * Returns the tiles from start to goal inclusive. If the goal is blocked or out of reach,
 * returns the path to the reachable tile closest to it, so units get as near as they can.
 */
export function findTilePath(
  world: World,
  start: GridRef,
  goal: GridRef,
  options: PathOptions = {},
): GridRef[] {
  const { avoid, maxNodes = MAX_PATH_NODES } = options;
  const nodes = new Map<number, Node>();
  // A slightly greedy heuristic expands far fewer tiles around obstacles; smoothing removes
  // most of the small detours it costs.
  const heuristic = (x: number, y: number) =>
    HEURISTIC_WEIGHT * worldDistance(x, y, goal.x, goal.y);
  const open = new OpenSet();

  const startNode: Node = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start.x, start.y),
    parent: null,
    closed: false,
  };
  nodes.set(nodeKey(start.x, start.y), startNode);
  open.push(startNode);

  let best = startNode;
  let expanded = 0;

  while (open.size > 0 && expanded < maxNodes) {
    const node = open.pop() as Node;
    if (node.closed) continue;
    node.closed = true;
    expanded++;

    if (node.h < best.h) best = node;
    if (node.x === goal.x && node.y === goal.y) break;

    for (const { dx, dy, cost } of STEPS) {
      const x = node.x + dx;
      const y = node.y + dy;
      if (!passable(world, x, y, avoid)) continue;
      // No squeezing diagonally between two blocked tiles.
      if (dx !== 0 && dy !== 0) {
        if (!passable(world, node.x + dx, node.y, avoid)) continue;
        if (!passable(world, node.x, node.y + dy, avoid)) continue;
      }

      const g = node.g + cost;
      const key = nodeKey(x, y);
      const existing = nodes.get(key);
      if (existing && (existing.closed || existing.g <= g)) continue;

      const next: Node = existing ?? {
        x,
        y,
        g,
        h: heuristic(x, y),
        parent: node,
        closed: false,
      };
      next.g = g;
      next.parent = node;
      nodes.set(key, next);
      open.push(next); // stale heap entries are skipped via `closed`
    }
  }

  const tiles: GridRef[] = [];
  for (let node: Node | null = best; node; node = node.parent) tiles.push(gridRef(node.x, node.y));
  return tiles.reverse();
}

/**
 * Whether a unit can walk in a straight line from `a` to `b`: the line and two parallel lines
 * a unit-radius to either side stay on passable tiles. Tiles under `a` are ignored so a unit
 * standing on a freshly blocked tile can still leave it.
 */
export function hasClearLine(
  world: World,
  a: Point,
  b: Point,
  avoid?: ReadonlySet<string>,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return true;

  const nx = (-dy / length) * UNIT_RADIUS;
  const ny = (dx / length) * UNIT_RADIUS;
  const startTile = gridFromWorld(a);
  const samples = Math.ceil(length / LOS_SAMPLE_STEP);

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    for (const side of [0, 1, -1]) {
      const tile = gridFromWorld({ x: px + nx * side, y: py + ny * side });
      if (tile.x === startTile.x && tile.y === startTile.y) continue;
      if (!passable(world, tile.x, tile.y, avoid)) return false;
    }
  }
  return true;
}

/** Drop waypoints that can be skipped with a straight walk ("string pulling"). */
export function smoothPath(
  world: World,
  from: Point,
  waypoints: readonly Point[],
  avoid?: ReadonlySet<string>,
): Point[] {
  const result: Point[] = [];
  let anchor = from;
  let i = 0;
  while (i < waypoints.length) {
    let j = i;
    while (
      j + 1 < waypoints.length &&
      hasClearLine(world, anchor, waypoints[j + 1] as Point, avoid)
    ) {
      j++;
    }
    const point = waypoints[j] as Point;
    result.push(point);
    anchor = point;
    i = j + 1;
  }
  return result;
}

/**
 * Waypoints from `from` towards `to`. Ends exactly at `to` when it is reachable, otherwise at
 * the centre of the closest reachable tile. Empty when the unit can't get any closer.
 */
export function findPath(world: World, from: Point, to: Point, options: PathOptions = {}): Point[] {
  const start = gridFromWorld(from);
  let destination = to;
  // Clicked on a building or acid: head for the nearest open tile instead, rather than letting
  // the search burn its whole budget trying to reach a tile it never can.
  const target = gridFromWorld(to);
  if (!passable(world, target.x, target.y, options.avoid)) {
    const [spot] = findFreeSpots(world, to, 1, options.avoid);
    if (!spot) return [];
    destination = spot;
  }
  const goal = gridFromWorld(destination);

  const tiles = findTilePath(world, start, goal, options);
  const end = tiles.at(-1) as GridRef;
  const reachedGoal = end.x === goal.x && end.y === goal.y;

  const waypoints = tiles.slice(1).map((tile) => worldFromGrid(tile.x, tile.y));
  if (reachedGoal) {
    waypoints.pop();
    waypoints.push({ ...destination });
  } else if (waypoints.length === 0) {
    return [];
  }
  return smoothPath(world, from, waypoints, options.avoid);
}

/**
 * `count` distinct standing spots around `center`, nearest first, one per passable tile: the
 * clicked point itself, then surrounding tile centres. Spreading a group's destinations like
 * this keeps units from piling onto one spot and blocking each other.
 */
export function findFreeSpots(
  world: World,
  center: Point,
  count: number,
  taken: ReadonlySet<string> = new Set(),
): Point[] {
  const origin = gridFromWorld(center);
  for (let radius = Math.ceil(Math.sqrt(count)) + 1; radius <= 64; radius *= 2) {
    const candidates: { tile: GridRef; point: Point; distance: number }[] = [];
    for (let y = origin.y - radius; y <= origin.y + radius; y++) {
      for (let x = origin.x - radius; x <= origin.x + radius; x++) {
        if (!passable(world, x, y, taken)) continue;
        const isOrigin = x === origin.x && y === origin.y;
        const point = isOrigin ? { ...center } : worldFromGrid(x, y);
        candidates.push({
          tile: gridRef(x, y),
          point,
          distance: Math.hypot(point.x - center.x, point.y - center.y),
        });
      }
    }
    if (candidates.length >= count || radius >= 64) {
      return candidates
        .sort((a, b) => a.distance - b.distance)
        .slice(0, count)
        .map((c) => c.point);
    }
  }
  return [];
}

/**
 * Pair each mover with a spot, greedily by shortest distance, so units fan out to the nearest
 * free spots instead of crossing the whole group.
 */
export function assignSpots<T>(
  movers: readonly { item: T; from: Point }[],
  spots: readonly Point[],
) {
  const pairs: { mover: number; spot: number; distance: number }[] = [];
  movers.forEach((m, mover) => {
    spots.forEach((s, spot) => {
      pairs.push({ mover, spot, distance: Math.hypot(s.x - m.from.x, s.y - m.from.y) });
    });
  });
  pairs.sort((a, b) => a.distance - b.distance);

  const assigned = new Map<T, Point>();
  const usedSpots = new Set<number>();
  for (const { mover, spot } of pairs) {
    const m = movers[mover];
    if (!m || assigned.has(m.item) || usedSpots.has(spot)) continue;
    assigned.set(m.item, spots[spot] as Point);
    usedSpots.add(spot);
  }
  return assigned;
}
