/**
 * The wind, as the shaders see it: where it blows, how hard, and how far it has carried things so
 * far. Everything that moves with the wind (plants, spores, dust, water) reads these, so they all
 * agree. The renderer brings them up to date every frame.
 */

import { uniform } from "three/tsl";
import * as THREE from "three/webgpu";
import { windAt } from "./wind";

/** Unit vector the wind blows towards, on the ground (world x, z). */
export const windDirection = uniform(new THREE.Vector2(1, 0));
/** From about 0.25 (a breeze) to 1 (a gust), eased so gusts build and fade. */
export const windStrength = uniform(0.5);
/** How far the wind has carried something light so far (world x, z), for drifting things. */
export const windDrift = uniform(new THREE.Vector2());

/** Tiles per second the wind carries spores and dust at full strength. */
const CARRY = 1.6;

/** Bring the wind up to date: `seconds` of world time, `dt` since the last frame. */
export function updateWind(seed: string, seconds: number, dt: number): void {
  const wind = windAt(seed, seconds);
  windDirection.value.set(wind.x, wind.y);
  windStrength.value += (wind.strength - windStrength.value) * Math.min(1, dt * 1.5);
  const carry = CARRY * windStrength.value * dt;
  windDrift.value.x += wind.x * carry;
  windDrift.value.y += wind.y * carry;
}
