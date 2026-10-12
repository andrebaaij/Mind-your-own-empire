/**
 * Authored 3D models (glTF, in public/models/), loaded once before the game starts. A unit with
 * an authored model is drawn with it; anything without one keeps its model built in code
 * (models.ts), so models can be added one at a time.
 */

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three/webgpu";
import type { ObjectName } from "./definitions";

interface ModelSpec {
  /** Length of the model's longest side, in tiles. */
  size: number;
}

/** The authored models, and how big each one is in the world. */
const SPECS: Partial<Record<ObjectName, ModelSpec>> = {
  block: { size: 0.42 },
};

const loaded = new Map<ObjectName, THREE.Object3D>();

/** Load every authored model; reports progress from 0 to 1. A model that fails is skipped. */
export async function loadModels(onProgress: (fraction: number) => void = () => {}): Promise<void> {
  const loader = new GLTFLoader();
  const names = Object.keys(SPECS) as ObjectName[];
  let done = 0;
  await Promise.all(
    names.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`./models/${name}.glb`);
        loaded.set(name, fitted(gltf.scene, SPECS[name]?.size ?? 1));
      } catch {
        // Fall back to the model built in code.
      }
      onProgress(++done / names.length);
    }),
  );
}

/** Scale a model so its longest side is `size`, centred on the origin. */
function fitted(scene: THREE.Object3D, size: number): THREE.Object3D {
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
  return holder;
}

/** A fresh copy of the authored model for `name`, if there is one. */
export function authoredModel(name: ObjectName): THREE.Object3D | null {
  return loaded.get(name)?.clone() ?? null;
}
