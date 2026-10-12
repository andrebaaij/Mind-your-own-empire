/**
 * 3D models: clean geometric shapes with glowing accents in the owner's colour, in the spirit
 * of the Culture's Minds, drones and orbital hardware. Where an authored model has been loaded
 * (assets.ts), it takes the place of the built one; the glow and aura stay.
 */

import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as THREE from "three/webgpu";
import { authoredModel, type Bed } from "./assets";
import { glowCss } from "./colors";
import type { ObjectName } from "./definitions";
import { latticeMaterial } from "./ruins";
import type { Color } from "./units";

/** A saturated glow colour derived from a (pastel) player colour. */
export function glowColor(color: Color): THREE.Color {
  return new THREE.Color(glowCss(color));
}

const hull = new THREE.MeshStandardMaterial({ color: "#b7bdc9", metalness: 0.35, roughness: 0.3 });
const darkHull = new THREE.MeshStandardMaterial({
  color: "#1b1f27",
  metalness: 0.8,
  roughness: 0.3,
});
const panel = new THREE.MeshStandardMaterial({
  color: "#1d2f72",
  metalness: 0.7,
  roughness: 0.18,
  emissive: "#0b1650",
  emissiveIntensity: 0.6,
});

function glowMaterial(color: THREE.Color, intensity = 3): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
  });
}

/** A soft, additive aura bubble, like a drone's effector field. */
function aura(color: THREE.Color, radius: number, opacity: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 16),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  mesh.name = "aura";
  return mesh;
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A base sunk into the ground, so buildings sit cleanly on uneven terrain. */
function plinth(width: number, depth: number): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(width, 0.8, depth), darkHull);
  m.position.y = -0.37;
  return m;
}

/** The Mind: a polished slab hovering over its plinth, ringed by a slowly turning halo. */
function mind(glow: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  group.add(plinth(2.9, 2.9));

  const body = new THREE.Group();
  body.name = "hover";
  body.position.y = 1.2;
  body.add(mesh(new RoundedBoxGeometry(2.1, 1.0, 2.1, 4, 0.22), hull));
  const seam = mesh(new THREE.BoxGeometry(2.14, 0.05, 2.14), glowMaterial(glow));
  body.add(seam);
  group.add(body);

  const halo = mesh(new THREE.TorusGeometry(1.55, 0.035, 8, 64), glowMaterial(glow, 2));
  halo.name = "spin";
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 1.2;
  group.add(halo);
  return group;
}

/** Worker drone: a small rounded casing with a sensor band, inside a faint aura. */
function workerDrone(glow: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  const authored = authoredModel("block");
  if (authored) {
    group.add(authored.model);
    if (authored.bed) group.add(cargoBed(authored.bed));
    group.add(aura(glow, 0.34, 0.12));
    return group;
  }
  group.add(mesh(new RoundedBoxGeometry(0.36, 0.26, 0.3, 3, 0.07), hull));
  const band = mesh(new THREE.BoxGeometry(0.05, 0.06, 0.24), glowMaterial(glow));
  band.position.x = 0.18; // facing +x, the unit's heading
  group.add(band);
  group.add(aura(glow, 0.34, 0.12));
  return group;
}

/** Scout drone: a sleek flier with glowing fins and a wide aura. */
function scoutDrone(glow: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.11, 0.42, 6, 16), hull);
  body.rotation.z = Math.PI / 2; // lie along +x
  group.add(body);
  for (const side of [-1, 1]) {
    const fin = mesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), glowMaterial(glow));
    fin.position.set(-0.08, 0, side * 0.14);
    group.add(fin);
  }
  group.add(aura(glow, 0.45, 0.08));
  return group;
}

/** Tower: a dark spire with a glowing tip and a floating ring. */
function tower(glow: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  group.add(plinth(0.8, 0.8));
  const spire = mesh(new THREE.CylinderGeometry(0.06, 0.26, 2.4, 6), darkHull);
  spire.position.y = 1.2;
  group.add(spire);
  const tip = mesh(new THREE.OctahedronGeometry(0.14), glowMaterial(glow, 4));
  tip.position.y = 2.55;
  group.add(tip);
  const ring = mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 32), glowMaterial(glow, 2));
  ring.name = "spin";
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.7;
  group.add(ring);
  return group;
}

/** Solar array: a tilted collector on a slim mast. */
function solar(glow: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  group.add(plinth(0.5, 0.5));
  const mast = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.75, 8), darkHull);
  mast.position.y = 0.37;
  group.add(mast);
  const collector = new THREE.Group();
  collector.position.y = 0.78;
  collector.rotation.z = 0.55;
  collector.add(mesh(new THREE.BoxGeometry(0.85, 0.035, 0.7), panel));
  const edge = mesh(new THREE.BoxGeometry(0.87, 0.012, 0.02), glowMaterial(glow, 2));
  edge.position.z = 0.35;
  collector.add(edge);
  group.add(collector);
  return group;
}

const bronze = new THREE.MeshStandardMaterial({
  color: "#6f8f7a",
  metalness: 0.6,
  roughness: 0.45,
});

/**
 * Warden of the Custody: an old, verdigris-bronze ring hanging in the air, trailing fine
 * manipulators, with an amber working light. Ten thousand years of polite maintenance.
 */
function warden(): THREE.Group {
  const group = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(0.36, 0.07, 10, 32), bronze);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const lamp = mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    glowMaterial(new THREE.Color("#ffb347"), 3),
  );
  lamp.name = "lamp";
  group.add(lamp);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const arm = mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.75, 6), bronze);
    arm.position.set(Math.cos(angle) * 0.3, -0.4, Math.sin(angle) * 0.3);
    arm.rotation.z = Math.cos(angle) * 0.25;
    arm.rotation.x = -Math.sin(angle) * 0.25;
    group.add(arm);
  }
  return group;
}

const idiranHull = new THREE.MeshStandardMaterial({
  color: "#3b3532",
  metalness: 0.75,
  roughness: 0.35,
  flatShading: true,
});
const idiranTrim = new THREE.MeshStandardMaterial({
  color: "#8a3a22",
  metalness: 0.5,
  roughness: 0.4,
});

/**
 * Idiran skimmer: a heavy, armoured wedge on two engine pods, with a red sensor eye. Built by a
 * species three metres tall that has never seen a reason to make anything light.
 */
function skimmer(): THREE.Group {
  const group = new THREE.Group();
  const hull = mesh(new THREE.CylinderGeometry(0.18, 0.55, 1.5, 4, 1), idiranHull);
  hull.rotation.z = -Math.PI / 2;
  hull.rotation.x = Math.PI / 4;
  hull.scale.set(1, 1, 0.55);
  const spine = mesh(new THREE.BoxGeometry(1.1, 0.12, 0.16), idiranTrim);
  spine.position.set(-0.1, 0.24, 0);
  const eye = mesh(
    new THREE.SphereGeometry(0.09, 12, 8),
    glowMaterial(new THREE.Color("#ff3b1f"), 4),
  );
  eye.position.set(0.72, 0.02, 0);
  group.add(hull, spine, eye);
  for (const side of [-1, 1]) {
    const pod = mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.7, 8), idiranHull);
    pod.rotation.z = Math.PI / 2;
    pod.position.set(-0.25, -0.12, side * 0.42);
    const flare = mesh(
      new THREE.CircleGeometry(0.11, 12),
      glowMaterial(new THREE.Color("#ff8a3d"), 3),
    );
    flare.rotation.y = -Math.PI / 2;
    flare.position.set(-0.61, -0.12, side * 0.42);
    group.add(pod, flare);
  }
  return group;
}

/** Decoy beacon: a spindly mast with a turning dish and a loud, false glow. */
function decoy(glow: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const leg = mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.75, 5), darkHull);
    leg.position.set(Math.cos(angle) * 0.14, 0.34, Math.sin(angle) * 0.14);
    leg.rotation.z = Math.cos(angle) * 0.35;
    leg.rotation.x = -Math.sin(angle) * 0.35;
    group.add(leg);
  }
  const head = new THREE.Group();
  head.name = "spin";
  head.position.y = 0.78;
  head.rotation.x = Math.PI / 2;
  const dish = mesh(new THREE.ConeGeometry(0.2, 0.1, 12, 1, true), hull);
  dish.rotation.x = Math.PI / 2;
  dish.position.x = 0.08;
  head.add(dish);
  group.add(head);
  const light = mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMaterial(glow, 4));
  light.position.y = 0.82;
  group.add(light, aura(glow, 0.35, 0.12));
  return group;
}

/** An Idiran forward camp: a dug-in hexagonal bunker under a tall, blinking mast. */
function camp(): THREE.Group {
  const group = new THREE.Group();
  const pad = mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.35, 6), idiranHull);
  pad.position.y = 0.1;
  const bunker = mesh(new THREE.CylinderGeometry(0.85, 1.15, 0.8, 6), idiranHull);
  bunker.position.y = 0.65;
  const band = mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.1, 6), idiranTrim);
  band.position.y = 0.8;
  const mast = mesh(new THREE.CylinderGeometry(0.04, 0.07, 2.4, 6), idiranHull);
  mast.position.set(0.4, 2, 0.3);
  const beacon = mesh(
    new THREE.SphereGeometry(0.1, 10, 8),
    glowMaterial(new THREE.Color("#ff3b1f"), 4),
  );
  beacon.position.set(0.4, 3.25, 0.3);
  group.add(pad, bunker, band, mast, beacon);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const slit = mesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.05),
      glowMaterial(new THREE.Color("#ff8a3d"), 2),
    );
    slit.position.set(Math.cos(angle) * 1.02, 0.75, Math.sin(angle) * 1.02);
    slit.rotation.y = -angle + Math.PI / 2;
    group.add(slit);
  }
  return group;
}

/** A landing pad: a broad hexagon ringed with guide lights, its centre ring turning slowly. */
function pad(glow: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  const deck = mesh(new THREE.CylinderGeometry(1.45, 1.5, 0.18, 6), hull);
  deck.position.y = 0.09;
  const inset = mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.02, 6), darkHull);
  inset.position.y = 0.19;
  group.add(plinth(2.6, 2.6), deck, inset);
  const ring = new THREE.Group();
  ring.name = "spin";
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.21;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const light = mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), glowMaterial(glow, 3));
    light.position.set(Math.cos(angle) * 0.75, Math.sin(angle) * 0.75, 0);
    light.rotation.z = angle + Math.PI / 2;
    ring.add(light);
  }
  group.add(ring);
  return group;
}

/** The uplink: a short mast of the Mind's own make, cabled into the Tessilend transmitter. */
function uplink(glow: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  const post = mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.1, 8), hull);
  post.position.y = 0.55;
  const head = mesh(new THREE.OctahedronGeometry(0.16, 0), glowMaterial(glow, 3));
  head.position.y = 1.2;
  group.add(plinth(0.6, 0.6), post, head, aura(glow, 0.45, 0.12));
  return group;
}

const builders: Record<ObjectName, (glow: THREE.Color) => THREE.Group> = {
  pad,
  uplink,
  camp,
  skimmer,
  decoy,
  mind,
  block: workerDrone,
  scout: scoutDrone,
  tower,
  solar,
  warden,
};

export function createModel(name: ObjectName, color: Color): THREE.Group {
  return builders[name](glowColor(color));
}

/** A see-through copy of a model for placement previews; materials are swapped by the caller. */
export function createGhost(name: ObjectName, material: THREE.Material): THREE.Group {
  const model = builders[name](new THREE.Color("#ffffff"));
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = material;
      child.castShadow = false;
      child.receiveShadow = false;
      if (child.name === "aura") child.visible = false;
    }
  });
  return model;
}

/** Iron ore: a cluster of angular crystals, sized by how much is left. */
export function createCrystalGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.OctahedronGeometry(0.22, 0);
  geometry.scale(0.8, 1.6, 0.8);
  geometry.translate(0, 0.25, 0);
  return geometry;
}

export const crystalMaterial = new THREE.MeshStandardMaterial({
  color: "#e0894a",
  metalness: 0.25,
  roughness: 0.35,
  emissive: "#ff7a2a",
  emissiveIntensity: 0.35,
  flatShading: true,
});

// --- Cargo ---------------------------------------------------------------------------------------

/** Crystals in a full bed: a layer of nine on the floor, heaped with three more. */
const CARGO_SLOTS = 12;
const cargoGeometry = new THREE.OctahedronGeometry(1, 0).scale(0.8, 1.5, 0.8);

/**
 * Where each crystal sits, as fractions of the bed (0–1 back to front, 0–1 side to side) and a
 * lift above the floor in crystal sizes. Loading starts in the middle and spreads out, then heaps.
 */
const CARGO_LAYOUT: readonly [number, number, number][] = [
  [0.5, 0.5, 0],
  [0.17, 0.5, 0],
  [0.83, 0.5, 0],
  [0.5, 0.17, 0],
  [0.5, 0.83, 0],
  [0.17, 0.17, 0],
  [0.83, 0.83, 0],
  [0.17, 0.83, 0],
  [0.83, 0.17, 0],
  [0.5, 0.5, 1.1],
  [0.33, 0.35, 0.9],
  [0.67, 0.65, 0.9],
];

/** An empty cargo bed: crystals for a full load, all hidden. `setCargo` shows what's carried. */
function cargoBed(bed: Bed): THREE.Group {
  const group = new THREE.Group();
  group.name = "cargo";
  const size = (Math.min(bed.x[1] - bed.x[0], bed.z[1] - bed.z[0]) / 3) * 0.55;
  CARGO_LAYOUT.forEach(([u, v, lift], i) => {
    const crystal = new THREE.Mesh(cargoGeometry, crystalMaterial);
    const floor = bed.floor[0] + (bed.floor[1] - bed.floor[0]) * u;
    crystal.position.set(
      bed.x[0] + (bed.x[1] - bed.x[0]) * u,
      floor + size * (0.9 + lift),
      bed.z[0] + (bed.z[1] - bed.z[0]) * v,
    );
    // Tumbled in any old way, but the same way every time.
    crystal.rotation.set(Math.sin(i * 7.1) * 0.6, i * 2.4, Math.cos(i * 3.3) * 0.6);
    crystal.userData.size = size * (0.85 + ((i * 37) % 10) / 40);
    crystal.scale.setScalar(0);
    crystal.visible = false;
    crystal.castShadow = true;
    group.add(crystal);
  });
  return group;
}

/**
 * Fill a cargo bed with what a unit carries: one crystal per twelfth of a full load (any load
 * shows at least one), bloom orange and lattice teal in proportion. New crystals pop in and
 * unloaded ones shrink away over `dt` seconds.
 */
export function setCargo(
  cargo: THREE.Object3D,
  bloom: number,
  lattice: number,
  capacity: number,
  dt: number,
): void {
  const total = bloom + lattice;
  const shown = total <= 0 ? 0 : Math.min(CARGO_SLOTS, Math.ceil((total / capacity) * CARGO_SLOTS));
  const bloomShown = total <= 0 ? 0 : Math.round((shown * bloom) / total);
  const rate = Math.min(1, dt * 12);
  cargo.children.forEach((child, i) => {
    if (!(child instanceof THREE.Mesh)) return;
    const wanted = i < shown;
    if (wanted) child.material = i < bloomShown ? crystalMaterial : latticeMaterial;
    const target = wanted ? (child.userData.size as number) : 0;
    const scale = child.scale.x + (target - child.scale.x) * rate;
    child.scale.setScalar(Math.abs(scale - target) < 0.0005 ? target : scale);
    child.visible = child.scale.x > 0;
  });
}
