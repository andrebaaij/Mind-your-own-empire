/**
 * Deterministic noise for things placed on the land, and where the parasol groves grow. Shared
 * by the scenery (which draws the trees) and the simulation (where groves give cover).
 */

/** A repeatable pseudo-random number in [0, 1) for a tile and a purpose. */
export function hash(x: number, y: number, salt: number): number {
  let h =
    Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1], for patches of growth that span several tiles. */
export function valueNoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, salt);
  const b = hash(x0 + 1, y0, salt);
  const c = hash(x0, y0 + 1, salt);
  const d = hash(x0 + 1, y0 + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Groves of parasol trees grow where this is above GROVE_THRESHOLD. */
export function groveDensity(x: number, y: number): number {
  return valueNoise(x / 23 + 50, y / 23 - 20, 11);
}

export const GROVE_THRESHOLD = 0.68;

/** Whether a point is under the grove canopy, where things on the ground are hard to see. */
export function inGrove(x: number, y: number): boolean {
  return groveDensity(Math.floor(x), Math.floor(y)) > GROVE_THRESHOLD;
}
