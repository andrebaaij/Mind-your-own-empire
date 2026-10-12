import alea from "alea";
import { createNoise2D, type NoiseFunction2D } from "simplex-noise";

export type Noise2D = NoiseFunction2D;

export function createNoise(seed: string): Noise2D {
  return createNoise2D(alea(seed));
}

/** Ground types. Acid can't be crossed by ground units or built on. */
export const Terrain = {
  Dirt: 0,
  Sand: 1,
  Acid: 2,
} as const;

export type TerrainType = (typeof Terrain)[keyof typeof Terrain];

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

export function noiseTerrain(noise: Noise2D): TerrainGenerator {
  return {
    ground: (x, y) => baseTerrain(noise, x, y),
    height: (x, y) => terrainHeight(noise, x, y),
    iron: (x, y) => Math.max(ironAmount(noise, x, y), starterIron(x, y)),
    siteSalt: Math.floor((noise(0.317, -0.713) + 1) * 1_000_000),
  };
}
