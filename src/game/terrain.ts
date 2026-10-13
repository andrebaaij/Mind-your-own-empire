import alea from "alea";
import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import {
  type BiomeWeights,
  biomeWeights,
  duneHeight,
  inPool,
  POOL_SURFACE,
  type Pool,
  poolDepth,
  poolLevelling,
  poolsNear,
  SINK_POND,
  type Sinkhole,
  sinkholeDepth,
  sinkholeLevelling,
  sinkholesNear,
  sinkPondSurface,
  topOfRamp,
} from "./biomes";
import { prevailingAngle } from "./wind";

export type Noise2D = NoiseFunction2D;

export function createNoise(seed: string): Noise2D {
  return createNoise2D(alea(seed));
}

/** Ground types. Acid and water can't be crossed by ground units or built on. */
export const Terrain = {
  Dirt: 0,
  Sand: 1,
  Acid: 2,
  Water: 3,
} as const;

export type TerrainType = (typeof Terrain)[keyof typeof Terrain];

/** Whether ground units are kept off a ground type: acid burns, water is water. */
export function isImpassableGround(ground: number | undefined): boolean {
  return ground === Terrain.Acid || ground === Terrain.Water;
}

/** Ground type of the tile at (x, y). */
export function baseTerrain(noise: Noise2D, x: number, y: number): TerrainType {
  let n = Math.round(noise(x / 150, y / 150) * 20) - 15;
  if (n > 5 || n < 0) n = 0;

  if (n <= 1) return Terrain.Dirt;
  if (n === 2) return Terrain.Sand;
  return Terrain.Acid;
}

/** Where the starting base sits; the ground around it is flattened so it can be built on. */
export const START_CENTER = { x: 5.5, y: 5.5 };
const FLAT_INNER = 9;
const FLAT_OUTER = 17;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Ground height at any point (in tiles, continuous): rolling hills, sharp ridges that form
 * cliffs, and hollows where the acid pools. Flat around the starting base.
 */
export function terrainHeight(noise: Noise2D, x: number, y: number): number {
  const hills = 2 * noise(x / 32 + 1000, y / 32 - 1000) + 0.4 * noise(x / 11 - 2000, y / 11 + 2000);
  // Sharp crests along the zero lines of a second noise; the steepest parts become cliffs.
  const ridges = (1 - Math.abs(noise(x / 26 + 300, y / 26 + 300))) ** 4;
  // The acid noise (see baseTerrain) also digs the hollows the acid lies in.
  const lake = smoothstep(0.78, 0.9, noise(x / 150, y / 150)) * 1.6;

  const flat = smoothstep(
    FLAT_INNER,
    FLAT_OUTER,
    Math.hypot(x - START_CENTER.x, y - START_CENTER.y),
  );
  return (hills + ridges - lake) * flat;
}

/**
 * Amount of iron in the tile at (x, y); zero or negative means none. Iron forms scattered
 * clusters a few tiles across. The ground around the starting base is kept clear, apart from
 * the starter deposits.
 */
export function ironAmount(noise: Noise2D, x: number, y: number): number {
  const n = noise(x / 14 + 77.7, y / 14 - 33.3);
  const clear = smoothstep(10, 14, Math.hypot(x + 0.5 - START_CENTER.x, y + 0.5 - START_CENTER.y));
  return Math.round((n - 0.55) * 10000 * clear);
}

/** Where terrain comes from. The game uses seeded noise; tests can supply simple layouts. */
export interface TerrainGenerator {
  ground(x: number, y: number): TerrainType;
  /** Continuous ground height at any point. */
  height(x: number, y: number): number;
  /** Iron in the tile at (x, y); zero or negative means none. */
  iron(x: number, y: number): number;
  /** Seeds where Tessilend sites are. Without it, only sites placed by hand exist. */
  siteSalt?: number;
  /** Which regions a point belongs to; without it, everywhere is rust desert. */
  biome?(x: number, y: number): BiomeWeights;
  /** Sinkholes reaching within `range` of a point. */
  sinkholes?(x: number, y: number, range: number): Sinkhole[];
  /** Height of open water at or near a point (its surface is flat), or null if there's none. */
  waterLevel?(x: number, y: number): number | null;
}

/** Deposits placed a short drone trip from the start, so there's always something to mine. */
export const STARTER_DEPOSITS = [
  { x: -3.5, y: 9.5 },
  { x: 13.5, y: -1.5 },
  { x: 6.5, y: 16.5 },
];

/** Iron in the starter deposits at (x, y): a rich centre fading out over about three tiles. */
export function starterIron(x: number, y: number): number {
  let best = 0;
  for (const deposit of STARTER_DEPOSITS) {
    const d2 = (x + 0.5 - deposit.x) ** 2 + (y + 0.5 - deposit.y) ** 2;
    best = Math.max(best, Math.round(2600 * Math.exp(-d2 / 4) - 400));
  }
  return best;
}

/**
 * The game's terrain: seeded noise for the lie of the land, its regions, and the landforms they
 * bring (dunes across the prevailing wind of `seed`'s world, oasis pools, sinkholes).
 */
export function noiseTerrain(noise: Noise2D, seed = ""): TerrainGenerator {
  const wind = prevailingAngle(seed);
  const regions = (x: number, y: number) => biomeWeights(noise, x, y, START_CENTER);

  // Features are looked up a lot (every height query), so they're kept per 16-tile cell.
  const CELL = 16;
  const sinkCache = new Map<string, Sinkhole[]>();
  const poolCache = new Map<string, Pool[]>();
  const cellOf = <T>(
    cache: Map<string, T[]>,
    x: number,
    y: number,
    find: (cx: number, cy: number) => T[],
  ) => {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const key = `${cx},${cy}`;
    let found = cache.get(key);
    if (!found) {
      found = find(cx * CELL + CELL / 2, cy * CELL + CELL / 2);
      cache.set(key, found);
    }
    return found;
  };
  const sinksAt = (x: number, y: number) =>
    cellOf(sinkCache, x, y, (cx, cy) => sinkholesNear(cx, cy, CELL, START_CENTER));
  const poolsAt = (x: number, y: number) =>
    cellOf(poolCache, x, y, (cx, cy) =>
      // Pools keep clear of sinkholes, so none floods a ramp.
      poolsNear(cx, cy, CELL, START_CENTER, (px, py) => regions(px, py).lush).filter(
        (pool) => sinkholesNear(pool.x, pool.y, pool.radius * 2 + 20, START_CENTER).length === 0,
      ),
    );

  /** The lie of the land before any sinkhole or pool is dug into it. */
  const natural = (px: number, py: number) => {
    const dunes = regions(px, py).dunes;
    return terrainHeight(noise, px, py) + (dunes > 0 ? duneHeight(px, py, wind, dunes) : 0);
  };

  const biome = (x: number, y: number): BiomeWeights => {
    const weights = regions(x, y);
    // The bottom of a sinkhole is a sheltered garden, whatever the land around it.
    for (const hole of sinksAt(x, y)) {
      const inside = Math.min(
        1,
        Math.max(0, (hole.radius + 0.5 - Math.hypot(x - hole.x, y - hole.y)) / 2),
      );
      if (inside <= 0) continue;
      for (const key of Object.keys(weights) as (keyof BiomeWeights)[]) {
        weights[key] =
          key === "lush" ? weights[key] + (1 - weights[key]) * inside : weights[key] * (1 - inside);
      }
    }
    return weights;
  };

  return {
    ground: (x, y) => {
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (poolsAt(cx, cy).some((pool) => inPool(pool, cx, cy))) return Terrain.Water;
      if (
        sinksAt(cx, cy).some(
          (hole) => Math.hypot(cx - hole.x, cy - hole.y) < hole.radius * SINK_POND,
        )
      ) {
        return Terrain.Water;
      }
      const ground = baseTerrain(noise, x, y);
      if (ground === Terrain.Dirt && regions(cx, cy).dunes > 0.55) return Terrain.Sand;
      return ground;
    },
    height: (x, y) => {
      let height = natural(x, y);
      for (const hole of sinksAt(x, y)) {
        // Level the land around the pit to the height at the top of its ramp, so no ridge
        // crosses the way down, then dig.
        const level = sinkholeLevelling(hole, x, y);
        if (level > 0) {
          const top = topOfRamp(hole);
          hole.ground ??= natural(top.x, top.y);
          height += (hole.ground - height) * level;
        }
        height -= sinkholeDepth(hole, x, y);
      }
      for (const pool of poolsAt(x, y)) {
        const level = poolLevelling(pool, x, y);
        if (level > 0) {
          pool.ground ??= natural(pool.x, pool.y);
          height += (pool.ground - height) * level;
        }
        height -= poolDepth(pool, x, y);
      }
      return height;
    },
    waterLevel: (x, y) => {
      for (const pool of poolsAt(x, y)) {
        if (Math.hypot(x - pool.x, y - pool.y) < pool.radius * 1.6) {
          pool.ground ??= natural(pool.x, pool.y);
          return pool.ground - POOL_SURFACE;
        }
      }
      for (const hole of sinksAt(x, y)) {
        if (Math.hypot(x - hole.x, y - hole.y) < hole.radius * 0.6) {
          const top = topOfRamp(hole);
          hole.ground ??= natural(top.x, top.y);
          return hole.ground - sinkPondSurface(hole);
        }
      }
      return null;
    },
    iron: (x, y) => Math.max(ironAmount(noise, x, y), starterIron(x, y)),
    siteSalt: Math.floor((noise(0.317, -0.713) + 1) * 1_000_000),
    biome,
    sinkholes: (x, y, range) => sinkholesNear(x, y, range, START_CENTER),
  };
}
