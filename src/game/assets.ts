/**
 * Authored 3D models (glTF, in public/models/), loaded once before the game starts. A unit with
 * an authored model is drawn with it; anything without one keeps its model built in code
 * (models.ts), so models can be added one at a time.
 *
 * The models come without glowing parts, so the glow is found in their colour textures: the
 * strongly cyan, amber or red parts light up (and the cyan, the Culture's, takes the player's
 * colour).
 */

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three/webgpu";
import type { ObjectName } from "./definitions";

/** A rectangular cargo bed on top of a model, which fills with what the unit carries. */
export interface Bed {
  shape: "box";
  /** Extent of the bed's floor along the model's forward (x) and sideways (z) axes. */
  x: [number, number];
  z: [number, number];
  /** Height of the floor at the back (x[0]) and the front (x[1]) of the bed. */
  floor: [number, number];
}

/** A ring-shaped trough around the middle of a model, which fills with what it stores. */
export interface Trough {
  shape: "ring";
  inner: number;
  outer: number;
  floor: number;
}

export type Hold = Bed | Trough;

/** Which colours in a model's texture glow. */
export type GlowHue = "cyan" | "amber" | "red";

interface ModelSpec {
  /** Length of the model's longest side, in tiles. */
  size: number;
  /** Stands on the ground (a building) rather than centred where it floats (a drone). */
  ground?: boolean;
  /** Turn needed to face the unit's heading (+x), in radians. */
  yaw?: number;
  glow?: GlowHue;
  /** Where it holds cargo, in the model file's own units (measured from the mesh). */
  hold?: Hold;
}

/** The authored models, and how each one sits in the world. */
const SPECS: Partial<Record<ObjectName, ModelSpec>> = {
  block: {
    size: 0.42,
    glow: "cyan",
    hold: { shape: "box", x: [-0.27, 0.11], z: [-0.24, 0.24], floor: [0.29, 0.23] },
  },
  mind: {
    size: 2.8,
    ground: true,
    glow: "cyan",
    hold: { shape: "ring", inner: 0.305, outer: 0.385, floor: -0.29 },
  },
  scout: { size: 0.6, yaw: -Math.PI / 2, glow: "cyan" },
  tower: { size: 2.6, ground: true, glow: "cyan" },
  warden: { size: 1, glow: "amber" },
  skimmer: { size: 1.5, glow: "red" },
  camp: { size: 3, ground: true, glow: "red" },
};

interface Loaded {
  model: THREE.Object3D;
  hold: Hold | null;
  glow: GlowHue | null;
  /** Height of the model's top, in tiles above its origin. */
  height: number;
}

const loaded = new Map<ObjectName, Loaded>();

/** Load every authored model; reports progress from 0 to 1. A model that fails is skipped. */
export async function loadModels(onProgress: (fraction: number) => void = () => {}): Promise<void> {
  const loader = new GLTFLoader();
  const names = Object.keys(SPECS) as ObjectName[];
  let done = 0;
  await Promise.all(
    names.map(async (name) => {
      const spec = SPECS[name];
      if (!spec) return;
      try {
        const gltf = await loader.loadAsync(`./models/${name}.glb`);
        if (spec.glow) addGlow(gltf.scene, spec.glow);
        loaded.set(name, fitted(gltf.scene, spec));
      } catch {
        // Fall back to the model built in code.
      }
      onProgress(++done / names.length);
    }),
  );
}

/**
 * Scale a model so its longest side is `size`, turned to face +x, and either centred (floating)
 * or standing on the origin (a building). Its hold, if it has one, goes along with it.
 */
function fitted(scene: THREE.Object3D, spec: ModelSpec): Loaded {
  const box = new THREE.Box3().setFromObject(scene);
  const extent = box.getSize(new THREE.Vector3());
  const scale = spec.size / Math.max(extent.x, extent.y, extent.z);
  const centre = box.getCenter(new THREE.Vector3());
  const base = spec.ground ? box.min.y : centre.y;
  scene.position.set(-centre.x * scale, -base * scale, -centre.z * scale);
  scene.scale.setScalar(scale);
  const turn = new THREE.Group();
  turn.rotation.y = spec.yaw ?? 0;
  turn.add(scene);
  const holder = new THREE.Group();
  holder.add(turn);
  holder.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // The hold, in the same place on the scaled model. (Holds are on models that face +x already.)
  const along = (value: number, axis: "x" | "z") => (value - centre[axis]) * scale;
  const up = (value: number) => (value - base) * scale;
  const hold = spec.hold;
  return {
    model: holder,
    hold:
      hold?.shape === "box"
        ? {
            shape: "box",
            x: [along(hold.x[0], "x"), along(hold.x[1], "x")],
            z: [along(hold.z[0], "z"), along(hold.z[1], "z")],
            floor: [up(hold.floor[0]), up(hold.floor[1])],
          }
        : hold?.shape === "ring"
          ? {
              shape: "ring",
              inner: hold.inner * scale,
              outer: hold.outer * scale,
              floor: up(hold.floor),
            }
          : null,
    glow: spec.glow ?? null,
    height: (box.max.y - base) * scale,
  };
}

/** How strongly a colour (0–1 channels) is of the given hue, from 0 to 1. */
export function glowAmount(r: number, g: number, b: number, hue: GlowHue): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  if (saturation < 0.45 || max < 0.55) return 0;
  let h: number;
  if (max === r) h = ((g - b) / (max - min) + 6) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  const degrees = h * 60;
  const ranges: Record<GlowHue, [number, number]> = {
    cyan: [165, 205],
    amber: [22, 50],
    red: [345, 375],
  };
  const [from, to] = ranges[hue];
  const inside =
    (degrees >= from && degrees <= to) || (degrees + 360 >= from && degrees + 360 <= to);
  if (!inside) return 0;
  return Math.min(1, (saturation - 0.45) * 3) * Math.min(1, (max - 0.55) * 4);
}

const GLOW_COLOR: Record<GlowHue, string> = { cyan: "#5fe0ff", amber: "#ffb347", red: "#ff4a2a" };

/** Light up the parts of a model's colour texture that are strongly of `hue`. */
function addGlow(scene: THREE.Object3D, hue: GlowHue): void {
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = child.material as THREE.MeshStandardMaterial;
    const image = material.map?.image as (CanvasImageSource & { width: number }) | undefined;
    if (!image?.width) return;
    const side = 256;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, side, side);
    const pixels = context.getImageData(0, 0, side, side);
    const data = pixels.data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      const amount = glowAmount(
        (data[i] ?? 0) / 255,
        (data[i + 1] ?? 0) / 255,
        (data[i + 2] ?? 0) / 255,
        hue,
      );
      if (amount > 0) lit++;
      const v = Math.round(amount * 255);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    if (lit === 0) return;
    context.putImageData(pixels, 0, 0);
    const mask = new THREE.CanvasTexture(canvas);
    mask.flipY = material.map?.flipY ?? false;
    mask.colorSpace = THREE.SRGBColorSpace;
    material.emissiveMap = mask;
    material.emissive = new THREE.Color(GLOW_COLOR[hue]);
    material.emissiveIntensity = 2.2;
    material.needsUpdate = true;
  });
}

/**
 * A fresh copy of the authored model for `name`, if there is one, with where it holds cargo and
 * how tall it is. A Culture model's glow takes the colour `glow`.
 */
export function authoredModel(
  name: ObjectName,
  glow?: THREE.Color,
): { model: THREE.Object3D; hold: Hold | null; height: number } | null {
  const found = loaded.get(name);
  if (!found) return null;
  const model = found.model.clone();
  if (glow && found.glow === "cyan") {
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = child.material as THREE.MeshStandardMaterial;
      if (!material.emissiveMap) return;
      child.material = material.clone();
      (child.material as THREE.MeshStandardMaterial).emissive = glow.clone();
    });
  }
  return { model, hold: found.hold, height: found.height };
}
