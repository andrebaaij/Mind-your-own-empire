import alea from "alea";
import { createNoise2D, type NoiseFunction2D } from "simplex-noise";

export type Noise2D = NoiseFunction2D;

export function createNoise(seed: string): Noise2D {
  return createNoise2D(alea(seed));
}

/** Base terrain types, named after their tile index in the `tiles` tileset. */
export const Terrain = {
  Dirt: 0,
  Sand: 5,
  Acid: 14,
} as const;

export type TerrainType = (typeof Terrain)[keyof typeof Terrain];

/** Raw terrain type for a tile, before the transition tiles are chosen. */
export function baseTerrain(noise: Noise2D, x: number, y: number): TerrainType {
  let n = Math.round(noise(x / 150, y / 150) * 20) - 15;
  if (n > 5 || n < 0) n = 0;

  if (n <= 1) return Terrain.Dirt;
  if (n === 2) return Terrain.Sand;
  return Terrain.Acid;
}

/**
 * Tile index to draw at (x, y). Sand tiles bordering dirt or acid get transition
 * tiles so the edges blend.
 */
export function terrainTile(noise: Noise2D, x: number, y: number): number {
  const at = (dx: number, dy: number) => baseTerrain(noise, x + dx, y + dy);

  const MM = at(0, 0);
  if (MM !== Terrain.Sand) return MM;

  const TL = at(-1, -1);
  const TM = at(0, -1);
  const TR = at(1, -1);
  const ML = at(-1, 0);
  const MR = at(1, 0);
  const BL = at(-1, 1);
  const BM = at(0, 1);
  const BR = at(1, 1);

  const { Dirt, Sand, Acid } = Terrain;

  // Sand to dirt: outside corners, inside corners, borders.
  if (ML === Sand && TM === Sand && TL === Dirt) return 6;
  if (MR === Sand && BM === Sand && BR === Dirt) return 7;
  if (ML === Sand && BM === Sand && BL === Dirt) return 8;
  if (MR === Sand && TM === Sand && TR === Dirt) return 9;

  if (ML === Dirt && TL === Dirt && TM === Dirt) return 10;
  if (MR === Dirt && BM === Dirt && BR === Dirt) return 11;
  if (ML === Dirt && BM === Dirt && BL === Dirt) return 12;
  if (TM === Dirt && TR === Dirt && MR === Dirt) return 13;

  if (ML === Dirt) return 1;
  if (TM === Dirt) return 2;
  if (BM === Dirt) return 3;
  if (MR === Dirt) return 4;

  // Sand to acid: outside corners, inside corners, borders.
  if (ML === Sand && TM === Sand && TL === Acid) return 29;
  if (MR === Sand && BM === Sand && BR === Acid) return 28;
  if (ML === Sand && BM === Sand && BL === Acid) return 31;
  if (MR === Sand && TM === Sand && TR === Acid) return 30;

  if (ML === Acid && TL === Acid && TM === Acid) return 35;
  if (MR === Acid && BM === Acid && BR === Acid) return 34;
  if (ML === Acid && BM === Acid && BL === Acid) return 33;
  if (TM === Acid && TR === Acid && MR === Acid) return 32;

  if (ML === Acid) return 39;
  if (TM === Acid) return 37;
  if (BM === Acid) return 38;
  if (MR === Acid) return 36;

  return MM;
}

/** Amount of iron in the ground at (x, y). Zero or negative means none. */
export function ironAmount(noise: Noise2D, x: number, y: number): number {
  return Math.round((Math.sin(noise(x / 50, y / 250)) - 0.4) * 15000);
}
