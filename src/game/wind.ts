/**
 * Lessuin's wind. It never stops: every world has a prevailing wind, from a direction set by its
 * seed, which veers slowly back and forth and comes in gusts. The land shows it (plants lean and
 * ripple, dust and spores drift, the dunes lie across it), and it's in the sound.
 *
 * The wind is a pure function of the seed and the time, so the same world always has the same
 * weather and nothing about it needs saving.
 */

import { hash } from "./cover";

export interface Wind {
  /** Unit vector the wind blows towards, on the ground plane (x, y as in the world). */
  x: number;
  y: number;
  /** How hard it blows, from about 0.25 (a breeze) to 1 (a gust). */
  strength: number;
}

/** A number from 0 to 1 for a seed string. */
function seedValue(seed: string, salt: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
  return hash(h, salt, 97);
}

/** The direction the prevailing wind blows towards, in radians, for a world seed. */
export function prevailingAngle(seed: string): number {
  return seedValue(seed, 1) * Math.PI * 2;
}

/** The wind at a moment (`seconds` since the world began). */
export function windAt(seed: string, seconds: number): Wind {
  const phase = seedValue(seed, 2) * 100;
  const t = seconds + phase;
  // Veers up to about 25° either side of the prevailing direction, over minutes.
  const veer = Math.sin(t / 97) * 0.3 + Math.sin(t / 41 + 1.3) * 0.14;
  const angle = prevailingAngle(seed) + veer;
  // A steady breeze, swelling over a minute or so, with gusts of a few seconds on top.
  const swell = 0.5 + 0.5 * Math.sin(t / 23 + 0.7);
  const gust = Math.max(0, Math.sin(t / 3.1) * Math.sin(t / 7.3 + 2.1));
  const strength = Math.min(1, 0.25 + swell * 0.35 + gust * 0.45);
  return { x: Math.cos(angle), y: Math.sin(angle), strength };
}
