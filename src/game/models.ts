/**
 * Procedural 3D models: clean geometric shapes with glowing accents in the owner's colour,
 * in the spirit of the Culture's Minds, drones and orbital hardware. No asset files needed.
 */

import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as THREE from "three/webgpu";
import type { ObjectName } from "./definitions";
import type { Color } from "./units";

/** A saturated glow colour derived from a (pastel) player colour. */
export function glowColor(color: Color): THREE.Color {
  const base = new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  // Neutral players glow the pale cyan of a drone's aura field.
  if (hsl.s < 0.05) return new THREE.Color("#8fe8ff");
  return new THREE.Color().setHSL(hsl.h, Math.max(hsl.s, 0.75), 0.6);
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

const builders: Record<ObjectName, (glow: THREE.Color) => THREE.Group> = {
  mind,
  block: workerDrone,
  scout: scoutDrone,
  tower,
  solar,
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
