/**
 * The ground's material. The terrain mesh carries the broad colour of the land in its vertex
 * colours (ground type, slope, fog); this adds the close-up detail in the shader, from noise, so
 * no textures need loading: grain and patches of dust, pebbles on the flats, layered rock on the
 * slopes, and a matching bumpiness so the low sun picks it all out.
 */

import {
  bumpMap,
  float,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  mx_worley_noise_float,
  normalWorld,
  positionWorld,
  sin,
  smoothstep,
  vec3,
  vertexColor,
} from "three/tsl";
import * as THREE from "three/webgpu";

/** The ground: with shader detail, or (`detailed` false, for weak GPUs) vertex colours only. */
export function createGroundMaterial(detailed = true): THREE.Material {
  if (!detailed) {
    return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  }
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0 });
  const p = positionWorld;

  // Fine grain and broad patches, in world space so neighbouring chunks line up.
  const grain = mx_fractal_noise_float(vec3(p.x.mul(2.4), p.z.mul(2.4), 0), 3, 2, 0.5);
  const patches = mx_noise_float(vec3(p.x.mul(0.3), p.z.mul(0.3), 7.3));
  // Pebbles: the cells of a Worley pattern, scattered over the flats.
  const cells = mx_worley_noise_float(vec3(p.x.mul(3.2), p.z.mul(3.2), 1.7));
  const pebble = smoothstep(0.22, 0.05, cells);

  // Steep ground shows layered rock: bands that follow height, warped by the grain.
  const steep = smoothstep(0.1, 0.32, float(1).sub(normalWorld.y));
  const strata = sin(p.y.mul(7).add(grain.mul(2.2)))
    .mul(0.5)
    .add(0.5);

  const base = vertexColor();
  const detail = float(1).add(grain.mul(0.22)).add(patches.mul(0.12));
  const flats = base.mul(detail).mul(mix(float(1), float(0.68), pebble.mul(float(1).sub(steep))));
  const rock = base.mul(detail).mul(strata.mul(0.4).add(0.75));
  material.colorNode = mix(flats, rock, steep);

  material.roughnessNode = float(0.86).add(grain.mul(0.08));
  const height = grain.mul(0.6).add(pebble.mul(0.5)).add(strata.mul(steep).mul(0.8));
  material.normalNode = bumpMap(height, float(1.1));
  return material;
}
