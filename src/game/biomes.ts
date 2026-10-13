/**
 * Lessuin's regions, and the landforms that make them. The rust desert around the landing site
 * gives way, further out, to golden dune seas whose ridges lie across the prevailing wind, to
 * plum-grey ashlands, to pale salt flats, and to lush basins where the ground is mossed and
 * water stands in pools. Here and there the ground has fallen into a sinkhole: a deep, round pit
 * with one ramp down, and a sheltered garden around a pool at the bottom.
 *
 * Regions are a matter of looks and plants; only water (which no ground unit can cross) and the
 * sinkholes' cliff walls change where units can go, and those stay well away from the start.
 */

import { hash } from "./cover";

export const BIOMES = ["rust", "dunes", "ash", "salt", "lush"] as const;
export type Biome = (typeof BIOMES)[number];
export type BiomeWeights = Record<Biome, number>;

type Noise = (x: number, y: number) => number;

/** The land around the start stays rust desert this far out, then blends into its region. */
const QUIET_RADIUS = 24;
const BLEND_RADIUS = 42;
/** Water and sinkholes only appear this far from the start (beyond any mission's ground). */
export const FEATURE_RADIUS = 62;

function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const RUST: BiomeWeights = { rust: 1, dunes: 0, ash: 0, salt: 0, lush: 0 };

/** How much of each region a point belongs to; the weights add up to 1. */
export function biomeWeights(noise: Noise, x: number, y: number, start: Point): BiomeWeights {
  const dry = noise(x / 210 + 4100, y / 210 - 2300);
  const mineral = noise(x / 170 - 900, y / 170 + 5200);
  const lush = smooth(0.18, 0.42, -dry);
  const ash = smooth(0.22, 0.46, mineral) * (1 - lush);
  const salt = smooth(0.3, 0.55, -mineral) * (1 - lush);
  const dunes = smooth(0.15, 0.4, dry) * (1 - ash) * (1 - salt);
  const rust = Math.max(0, 1 - lush - ash - salt - dunes);
  const total = lush + ash + salt + dunes + rust || 1;
  const t = smooth(QUIET_RADIUS, BLEND_RADIUS, Math.hypot(x - start.x, y - start.y));
  const w = (biome: Biome, value: number) => RUST[biome] * (1 - t) + (value / total) * t;
  return {
    rust: w("rust", rust),
    dunes: w("dunes", dunes),
    ash: w("ash", ash),
    salt: w("salt", salt),
    lush: w("lush", lush),
  };
}

/** The region a point mostly belongs to. */
export function dominantBiome(weights: BiomeWeights): Biome {
  let best: Biome = "rust";
  for (const biome of BIOMES) if (weights[biome] > weights[best]) best = biome;
  return best;
}

interface Point {
  x: number;
  y: number;
}

// --- Dunes ---------------------------------------------------------------------------------------

/**
 * Dune ridges: long, gentle crests lying across the wind, steep on the downwind side like real
 * dunes, only where the dune sea is. `wind` is the prevailing direction (radians).
 */
export function duneHeight(x: number, y: number, wind: number, dunes: number): number {
  if (dunes <= 0) return 0;
  const along = x * Math.cos(wind) + y * Math.sin(wind);
  const across = -x * Math.sin(wind) + y * Math.cos(wind);
  // Ridges wander a little, so they aren't ruled lines.
  const phase = (along + Math.sin(across / 13) * 3) / 9;
  const f = phase - Math.floor(phase);
  // Long gentle windward slope (f 0→0.8), short slip face (0.8→1).
  const profile = f < 0.8 ? f / 0.8 : (1 - f) / 0.2;
  return profile * profile * 0.55 * dunes;
}

// --- Features: oasis pools and sinkholes -----------------------------------------------------------

export interface Sinkhole {
  x: number;
  y: number;
  radius: number;
  depth: number;
  /** Direction from the centre in which the ramp down leads out (radians). */
  ramp: number;
  /** Height of the land the pit is dug into (levelled to the top of the ramp), once known. */
  ground?: number;
}

/** Where the ramp down into a sinkhole starts. */
export function topOfRamp(hole: Sinkhole): { x: number; y: number } {
  const reach = hole.radius + 12;
  return { x: hole.x + Math.cos(hole.ramp) * reach, y: hole.y + Math.sin(hole.ramp) * reach };
}

/**
 * How far the land around a sinkhole is levelled (0 to 1): fully out to the top of its ramp,
 * easing back to the natural lie of the land a few tiles further.
 */
export function sinkholeLevelling(hole: Sinkhole, x: number, y: number): number {
  return smooth(hole.radius + 18, hole.radius + 12, Math.hypot(x - hole.x, y - hole.y));
}

export interface Pool {
  x: number;
  y: number;
  radius: number;
  /** Height of the land the pool lies in (levelled to its centre's), once known. */
  ground?: number;
}

const SINK_CELL = 64;
const POOL_CELL = 38;

/** The sinkholes whose ground reaches within `range` of a point. */
export function sinkholesNear(x: number, y: number, range: number, start: Point): Sinkhole[] {
  const found: Sinkhole[] = [];
  const reach = range + 20;
  for (
    let cy = Math.floor((y - reach) / SINK_CELL);
    cy <= Math.floor((y + reach) / SINK_CELL);
    cy++
  ) {
    for (
      let cx = Math.floor((x - reach) / SINK_CELL);
      cx <= Math.floor((x + reach) / SINK_CELL);
      cx++
    ) {
      if (hash(cx, cy, 401) > 0.4) continue;
      const sx = (cx + 0.25 + hash(cx, cy, 402) * 0.5) * SINK_CELL;
      const sy = (cy + 0.25 + hash(cx, cy, 403) * 0.5) * SINK_CELL;
      const radius = 6 + hash(cx, cy, 404) * 3;
      if (Math.hypot(sx - start.x, sy - start.y) < FEATURE_RADIUS + radius + 10) continue;
      if (Math.hypot(sx - x, sy - y) > range + radius + 19) continue;
      found.push({ x: sx, y: sy, radius, depth: 3.4, ramp: hash(cx, cy, 405) * Math.PI * 2 });
    }
  }
  return found;
}

/**
 * How far a sinkhole lowers the ground at a point: a cliff wall all round, except a ramp gentle
 * enough to walk down, and a shallow bowl at the bottom.
 */
export function sinkholeDepth(hole: Sinkhole, x: number, y: number): number {
  const d = Math.hypot(x - hole.x, y - hole.y);
  if (d > hole.radius + 13) return 0;
  const angle = Math.atan2(y - hole.y, x - hole.x);
  const off = Math.abs(Math.atan2(Math.sin(angle - hole.ramp), Math.cos(angle - hole.ramp)));
  const ramp = 1 - smooth(0.26, 0.4, off);
  const wall = smooth(hole.radius, hole.radius - 1.1, d);
  // A straight ramp, so it's no steeper in the middle than at the ends: about a quarter of a
  // tile down per tile along, well within what a drone can climb.
  const slope = Math.min(1, Math.max(0, (hole.radius + 12 - d) / 13));
  return hole.depth * (wall * (1 - ramp) + slope * ramp) + sinkholeBowl(hole, d) * wall;
}

/** The pools whose water may reach within `range` of a point. */
export function poolsNear(
  x: number,
  y: number,
  range: number,
  start: Point,
  lushAt: (x: number, y: number) => number,
): Pool[] {
  const found: Pool[] = [];
  const reach = range + 8;
  for (
    let cy = Math.floor((y - reach) / POOL_CELL);
    cy <= Math.floor((y + reach) / POOL_CELL);
    cy++
  ) {
    for (
      let cx = Math.floor((x - reach) / POOL_CELL);
      cx <= Math.floor((x + reach) / POOL_CELL);
      cx++
    ) {
      if (hash(cx, cy, 501) > 0.7) continue;
      const px = (cx + 0.2 + hash(cx, cy, 502) * 0.6) * POOL_CELL;
      const py = (cy + 0.2 + hash(cx, cy, 503) * 0.6) * POOL_CELL;
      const radius = 2.5 + hash(cx, cy, 504) * 2.5;
      if (Math.hypot(px - start.x, py - start.y) < FEATURE_RADIUS + radius + 6) continue;
      if (Math.hypot(px - x, py - y) > range + radius + 6) continue;
      // Oases are where the land is lush.
      if (lushAt(px, py) < 0.55) continue;
      found.push({ x: px, y: py, radius });
    }
  }
  return found;
}

/** How far out a point is in a pool's basin: 1 at its (wobbly) shoreline. */
function poolReach(pool: Pool, x: number, y: number): number {
  const angle = Math.atan2(y - pool.y, x - pool.x);
  const wobble = 1 + Math.sin(angle * 3 + pool.x) * 0.18 + Math.sin(angle * 5 + pool.y) * 0.1;
  return Math.hypot(x - pool.x, y - pool.y) / (pool.radius * wobble);
}

/** A pool's shoreline wobbles, so it isn't a circle. Is (x, y) under its water? */
export function inPool(pool: Pool, x: number, y: number): boolean {
  return poolReach(pool, x, y) < 1;
}

/** How far a pool's basin lowers the ground: a gentle dip that walkers can go round. */
export function poolDepth(pool: Pool, x: number, y: number): number {
  return 0.8 * smooth(1.8, 0.5, poolReach(pool, x, y));
}

/** How far the land around a pool is levelled to its centre's height, so the water lies flat. */
export function poolLevelling(pool: Pool, x: number, y: number): number {
  return smooth(2.6, 1.7, Math.hypot(x - pool.x, y - pool.y) / pool.radius);
}

/** How much below the levelled ground a pool's surface lies: just above its shoreline's floor. */
export const POOL_SURFACE = 0.8 * smooth(1.8, 0.5, 1) - 0.03;

/** The pond at the bottom of a sinkhole reaches this far out (a fraction of its radius). */
export const SINK_POND = 0.36;

/** The sinkhole's floor dips towards its pond: how far below the floor a point is. */
export function sinkholeBowl(hole: Sinkhole, d: number): number {
  return 0.9 * (1 - Math.min(1, d / (hole.radius * 0.6)) ** 2);
}

/** How far below the levelled ground a sinkhole's pond surface lies. */
export function sinkPondSurface(hole: Sinkhole): number {
  return hole.depth + sinkholeBowl(hole, hole.radius * SINK_POND) - 0.03;
}
