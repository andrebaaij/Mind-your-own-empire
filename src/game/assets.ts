/**
 * Authored 3D models (glTF, in public/models/), loaded once before the game starts. A unit with
 * an authored model is drawn with it; anything without one keeps its model built in code
 * (models.ts), so models can be added one at a time.
 */

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three/webgpu";
import type { ObjectName } from "./definitions";

/** A cargo bed on top of a model, which fills with what the unit carries. */
export interface Bed {
  /** Extent of the bed's floor along the model's forward (x) and sideways (z) axes. */
  x: [number, number];
  z: [number, number];
  /** Height of the floor at the back (x[0]) and the front (x[1]) of the bed. */
  floor: [number, number];
}

interface ModelSpec {
  /** Length of the model's longest side, in tiles. */
  size: number;
  /** Where its cargo bed is, in the model file's own units (measured from the mesh). */
  bed?: Bed;
}

/** The authored models, and how big each one is in the world. */
const SPECS: Partial<Record<ObjectName, ModelSpec>> = {
  block: { size: 0.42, bed: { x: [-0.27, 0.11], z: [-0.24, 0.24], floor: [0.29, 0.23] } },
};

const loaded = new Map<ObjectName, { model: THREE.Object3D; bed: Bed | null }>();

/** Load every authored model; reports progress from 0 to 1. A model that fails is skipped. */
export async function loadModels(onProgress: (fraction: number) => void = () => {}): Promise<void> {
  const loader = new GLTFLoader();
  const names = Object.keys(SPECS) as ObjectName[];
  let done = 0;
  await Promise.all(
    names.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`./models/${name}.glb`);
        const spec = SPECS[name] ?? { size: 1 };
        loaded.set(name, fitted(gltf.scene, spec.size, spec.bed));
      } catch {
        // Fall back to the model built in code.
      }
      onProgress(++done / names.length);
    }),
  );
}

/**
 * Scale a model so its longest side is `size`, centred on the origin; its bed, if it has one,
 * goes along with it.
 */
function fitted(
  scene: THREE.Object3D,
  size: number,
  bed: Bed | undefined,
): { model: THREE.Object3D; bed: Bed | null } {
  const box = new THREE.Box3().setFromObject(scene);
  const extent = box.getSize(new THREE.Vector3());
  const scale = size / Math.max(extent.x, extent.y, extent.z);
  const centre = box.getCenter(new THREE.Vector3());
  scene.position.copy(centre).multiplyScalar(-scale);
  scene.scale.setScalar(scale);
  const holder = new THREE.Group();
  holder.add(scene);
  holder.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  const move = (value: number, axis: "x" | "y" | "z") => (value - centre[axis]) * scale;
  return {
    model: holder,
    bed: bed
      ? {
          x: [move(bed.x[0], "x"), move(bed.x[1], "x")],
          z: [move(bed.z[0], "z"), move(bed.z[1], "z")],
          floor: [move(bed.floor[0], "y"), move(bed.floor[1], "y")],
        }
      : null,
  };
}

/** A fresh copy of the authored model for `name`, if there is one, and where its bed is. */
export function authoredModel(name: ObjectName): { model: THREE.Object3D; bed: Bed | null } | null {
  const found = loaded.get(name);
  return found ? { model: found.model.clone(), bed: found.bed } : null;
}
