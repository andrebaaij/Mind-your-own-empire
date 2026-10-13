/**
 * Lessuin's sky and air: a late-afternoon sky that never quite ends, the ringed gas giant
 * Lessuin orbits, warm haze where the unexplored ground fades out, and spores and dust drifting
 * on the wind. Everything here follows the camera; none of it is part of the world.
 */

import {
  color,
  float,
  hash,
  instanceIndex,
  mix,
  mod,
  normalize,
  positionLocal,
  pow,
  sin,
  smoothstep,
  time,
  uniform,
  vec3,
} from "three/tsl";
import * as THREE from "three/webgpu";
import { windDirection, windDrift, windStrength } from "./windField";

/** The haze below the horizon, which is also the fog colour: unexplored ground fades into it. */
export const MIST = new THREE.Color("#4a3230");
const HORIZON = "#d08a5c";
const HIGH_SKY = "#34405e";
const ZENITH = "#141a30";

/** Where the setting sun is (towards it), for both the sky and the light that casts shadows. */
export const SUN_DIRECTION = new THREE.Vector3(-0.78, 0.07, -0.6).normalize();
/** The gas giant hangs low on the opposite side of the sky. */
const GIANT_DIRECTION = new THREE.Vector3(0.62, 0.07, 0.76).normalize();

/** Where the spores gather: a uniform holding the point the camera looks at. */
type SporeCenter = ReturnType<typeof sporeCenter>;
const sporeCenter = () => uniform(new THREE.Vector3());

const SKY_RADIUS = 300;
const SPORE_COUNT = 260;
/** Spores fill a box this wide around what the camera looks at. */
const SPORE_BOX = 44;

function skyMaterial(): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, fog: false });
  material.depthWrite = false;
  const direction = normalize(positionLocal);
  const up = direction.y;

  // Mist below the horizon, a warm band at it, then dusk blue overhead.
  const below = mix(color(MIST), color(HORIZON), smoothstep(-0.25, 0.0, up));
  const above = mix(
    color(HORIZON),
    mix(color(HIGH_SKY), color(ZENITH), smoothstep(0.35, 0.9, up)),
    smoothstep(0.0, 0.3, up),
  );
  let sky = mix(below, above, smoothstep(-0.02, 0.02, up));

  // The sun: a hot disc in a wide glow that warms the sky around it.
  const towardsSun = direction.dot(vec3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z));
  sky = sky.add(
    color("#ff9a55")
      .mul(pow(towardsSun.max(0), 6))
      .mul(0.45),
  );
  sky = sky.add(
    color("#ffe2b0")
      .mul(smoothstep(0.9985, 0.9993, towardsSun))
      .mul(3.5),
  );

  material.colorNode = sky;
  return material;
}

/** Lessuin's primary: a banded gas giant, its night side to us, with a thin bright ring. */
function createGiant(): THREE.Group {
  const giant = new THREE.Group();
  const bands = new THREE.MeshBasicNodeMaterial({ fog: false });
  const latitude = positionLocal.y.div(28);
  const stripes = sin(latitude.mul(19)).mul(0.5).add(0.5);
  const swirl = sin(latitude.mul(53).add(positionLocal.x.div(9)))
    .mul(0.5)
    .add(0.5);
  const base = mix(color("#9a6a58"), color("#d9b08c"), stripes.mul(0.7).add(swirl.mul(0.3)));
  // Lit from the sun's side: a crescent, fading into the dusk.
  const lit = smoothstep(
    -0.3,
    0.6,
    normalize(positionLocal).dot(vec3(-0.9, 0.15, -0.4).normalize()),
  );
  bands.colorNode = base.mul(lit.mul(0.85).add(0.12));
  const body = new THREE.Mesh(new THREE.SphereGeometry(28, 48, 32), bands);
  body.renderOrder = -1; // after the sky dome, before the land

  const ringMaterial = new THREE.MeshBasicNodeMaterial({
    fog: false,
    side: THREE.DoubleSide,
    transparent: true,
  });
  ringMaterial.depthWrite = false;
  const radius = positionLocal.xy.length();
  const grooves = sin(radius.mul(1.7)).mul(0.25).add(0.75);
  ringMaterial.colorNode = color("#e8cfa8").mul(grooves);
  ringMaterial.opacityNode = smoothstep(36, 39, radius)
    .mul(float(1).sub(smoothstep(52, 56, radius)))
    .mul(grooves)
    .mul(0.55);
  const ring = new THREE.Mesh(new THREE.RingGeometry(34, 58, 96, 4), ringMaterial);
  ring.rotation.set(-1.2, 0.25, 0.3);

  giant.add(body, ring);
  giant.rotation.z = 0.35;
  giant.scale.setScalar(1.35);
  giant.position.copy(GIANT_DIRECTION).multiplyScalar(210);
  return giant;
}

/** Glowing spores, drifting on the wind in a box that follows the camera. */
function createSpores(center: SporeCenter): THREE.InstancedMesh {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const seed = instanceIndex.toFloat();
  const start = vec3(hash(seed), hash(seed.add(17.3)), hash(seed.add(41.9)));
  // Carried by the wind, each wandering a little on its own way.
  const drift = vec3(
    windDrift.x.add(sin(time.mul(0.3).add(seed.mul(2.1))).mul(0.6)),
    sin(time.mul(0.4).add(seed)).mul(0.5),
    windDrift.y.add(sin(time.mul(0.27).add(seed.mul(1.3))).mul(0.6)),
  );
  const box = float(SPORE_BOX);
  const wrapped = start.mul(vec3(box, 2.6, box)).add(drift);
  const x = mod(wrapped.x.sub(center.x), box).add(center.x).sub(box.div(2));
  const z = mod(wrapped.z.sub(center.z), box).add(center.z).sub(box.div(2));
  const y = center.y.add(wrapped.y).add(0.3);
  material.positionNode = positionLocal.add(vec3(x, y, z));

  const twinkle = sin(time.mul(hash(seed.add(5)).mul(2).add(1)).add(seed))
    .mul(0.5)
    .add(0.5);
  material.colorNode = mix(color("#ffcf8a"), color("#8affd8"), hash(seed.add(9))).mul(
    twinkle.mul(1.6).add(0.4),
  );

  const spores = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.025, 0),
    material,
    SPORE_COUNT,
  );
  spores.frustumCulled = false;
  return spores;
}

const DUST_COUNT = 240;
/** Dust wisps fill a box this wide around what the camera looks at. */
const DUST_BOX = 36;

/**
 * Dust wisps: faint streaks of blown sand skimming low over the ground, lined up with the wind
 * and carried along faster than the spores. They show in the gusts and all but vanish in a
 * breeze.
 */
function createDust(center: SporeCenter): THREE.InstancedMesh {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const seed = instanceIndex.toFloat().add(500);
  const start = vec3(hash(seed), hash(seed.add(13.1)), hash(seed.add(29.7)));
  const box = float(DUST_BOX);
  const carried = start
    .mul(vec3(box, 1, box))
    .add(vec3(windDrift.x.mul(2.6), 0, windDrift.y.mul(2.6)));
  const x = mod(carried.x.sub(center.x), box).add(center.x).sub(box.div(2));
  const z = mod(carried.z.sub(center.z), box).add(center.z).sub(box.div(2));
  const y = center.y.add(start.y.mul(1.1)).add(0.15);
  // Turn the streak (long along its local x) to lie along the wind.
  const local = positionLocal;
  const along = vec3(
    local.x.mul(windDirection.x).sub(local.z.mul(windDirection.y)),
    local.y,
    local.x.mul(windDirection.y).add(local.z.mul(windDirection.x)),
  );
  material.positionNode = along.add(vec3(x, y, z));

  // Each wisp comes and goes, and only shows when the wind is up.
  const life = sin(time.mul(hash(seed.add(3)).mul(0.6).add(0.4)).add(seed.mul(7)))
    .mul(0.5)
    .add(0.5);
  const gusting = smoothstep(0.35, 0.85, windStrength);
  material.colorNode = color("#e2b98a");
  material.opacityNode = life.mul(life).mul(gusting).mul(0.16);

  const geometry = new THREE.PlaneGeometry(2.2, 0.07);
  geometry.rotateX(-Math.PI / 2);
  const dust = new THREE.InstancedMesh(geometry, material, DUST_COUNT);
  dust.frustumCulled = false;
  return dust;
}

/** The sky on its own, for lighting the scene with it (image-based lighting). */
export function createSkyScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial()));
  return scene;
}

export class Atmosphere {
  readonly group = new THREE.Group();
  private readonly sky: THREE.Group;
  private readonly sporeCenter = sporeCenter();

  constructor() {
    this.sky = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), skyMaterial());
    dome.renderOrder = -2;
    this.sky.add(dome, createGiant());
    this.group.add(this.sky, createSpores(this.sporeCenter), createDust(this.sporeCenter));
  }

  /** Keep the sky around the camera and the spores around what it looks at. */
  update(camera: THREE.Vector3, target: THREE.Vector3): void {
    this.sky.position.copy(camera);
    this.sporeCenter.value.copy(target);
  }
}
