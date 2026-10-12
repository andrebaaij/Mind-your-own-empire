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

/** Amount of iron in the ground at (x, y). Zero or negative means none. */
export function ironAmount(noise: Noise2D, x: number, y: number): number {
  return Math.round((Math.sin(noise(x / 50, y / 250)) - 0.4) * 15000);
}

/** Where terrain comes from. The game uses seeded noise; tests can supply simple layouts. */
export interface TerrainGenerator {
  ground(x: number, y: number): TerrainType;
  /** Continuous ground height at any point. */
  height(x: number, y: number): number;
  /** Iron in the tile at (x, y); zero or negative means none. */
  iron(x: number, y: number): number;
}

export function noiseTerrain(noise: Noise2D): TerrainGenerator {
  return {
    ground: (x, y) => baseTerrain(noise, x, y),
    height: (x, y) => terrainHeight(noise, x, y),
    iron: (x, y) => ironAmount(noise, x, y),
  };
}
