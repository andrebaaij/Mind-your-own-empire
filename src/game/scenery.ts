/**
 * Lessuin's scenery: alien flora, rocks, Tessilend ruins and the debris of the Mind's crash.
 * Purely visual: it never blocks units or buildings. Placement is deterministic per tile, so a
 * world always looks the same, and everything is drawn as a handful of instanced meshes.
 */

import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { color, cos, float, positionGeometry, positionLocal, sin, time, vec3 } from "three/tsl";
import * as THREE from "three/webgpu";
import { CHUNK_SIZE } from "./config";
import { GROVE_THRESHOLD, groveDensity, hash, valueNoise } from "./cover";
import { START_CENTER, Terrain } from "./terrain";
import type { Chunk, World } from "./world";

export { hash, valueNoise };

export type DecorKind =
  | "grass"
  | "shrub"
  | "lantern"
  | "bulb"
  | "tree"
  | "rock"
  | "column"
  | "arch"
  | "debris";

export interface DecorItem {
  kind: DecorKind;
  /** Tile index in its chunk, to hide it under buildings and in the fog. */
  tile: number;
  x: number;
  y: number;
  height: number;
  rotation: number;
  scale: number;
  /** Brightness variation, around 1. */
  shade: number;
}

// --- Placement ---------------------------------------------------------------------------------

const CRASH_RADIUS = 6;
const BASE_RADIUS = 9;

/**
 * Scenery for one chunk. The crash site around the Mind is strewn with wreckage; the base
 * around it has only sparse grass, so there's room to build; further out, plants grow in
 * patches, lantern stalks gather in the hollows, rocks cling to slopes and cliffs, and every
 * so often a Tessilend ruin stands in the open.
 */
export function generateDecor(world: World, chunk: Chunk): DecorItem[] {
  const items: DecorItem[] = [];
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const i = lx + ly * CHUNK_SIZE;
      const x = chunk.x * CHUNK_SIZE + lx;
      const y = chunk.y * CHUNK_SIZE + ly;
      const ground = chunk.tiles[i];
      if (ground === Terrain.Acid) continue;

      const r = (salt: number) => hash(x, y, salt);
      const place = (kind: DecorKind, salt: number, scale = 1) => {
        const px = x + 0.15 + r(salt) * 0.7;
        const py = y + 0.15 + r(salt + 1) * 0.7;
        items.push({
          kind,
          tile: i,
          x: px,
          y: py,
          height: world.heightAt(px, py),
          rotation: r(salt + 2) * Math.PI * 2,
          scale: scale * (0.75 + r(salt + 3) * 0.5),
          shade: 0.85 + r(salt + 4) * 0.3,
        });
      };

      // Tessilend paving: only a little grass has found the cracks.
      if (chunk.paved[i] === 1 || chunk.ruin[i] === 1) {
        if (chunk.paved[i] === 1 && r(15) < 0.12) place("grass", 130, 0.7);
        continue;
      }

      const fromStart = Math.hypot(x + 0.5 - START_CENTER.x, y + 0.5 - START_CENTER.y);
      if (fromStart < CRASH_RADIUS) {
        if (r(1) < 0.09) place("debris", 10);
        if (r(2) < 0.05) place("debris", 20, 0.7);
        continue;
      }
      if (fromStart < BASE_RADIUS) {
        if (r(3) < 0.18) place("grass", 30);
        continue;
      }

      if (chunk.cliffs[i] === 1) {
        if (r(4) < 0.55) place("rock", 40, 1 + r(5) * 0.9);
        if (r(6) < 0.25) place("rock", 50, 0.6);
        continue;
      }

      const hasIron = chunk.resources[i] !== undefined;
      const fertile = valueNoise(x / 9, y / 9, 7);
      const grove = groveDensity(x, y);
      const height = chunk.heights[i] ?? 0;
      const flat = fromStart > 18 && chunk.cliffs[i] === 0;

      if (flat && !hasIron && r(7) < 0.005) {
        place(r(8) < 0.35 ? "arch" : "column", 60);
        continue;
      }
      if (!hasIron && grove > GROVE_THRESHOLD && r(9) < 0.16) {
        place("tree", 70, 0.85);
        continue;
      }
      if (!hasIron && (height < -0.7 || ground === Terrain.Sand) && r(10) < 0.14) {
        place("lantern", 80);
        // The bulb sits on the stalk: same spot, drawn with its own glowing material.
        const stalk = items[items.length - 1];
        if (stalk) items.push({ ...stalk, kind: "bulb" });
      }
      if (!hasIron && fertile > 0.55 && r(11) < 0.12) place("shrub", 90);
      if (r(12) < 0.04) place("rock", 100, 0.7);
      if (fertile > 0.3 && r(13) < 0.2 + fertile * 0.4) place("grass", 110);
      if (fertile > 0.6 && r(14) < 0.3) place("grass", 120, 0.8);
    }
  }
  return items;
}

// --- Geometry ------------------------------------------------------------------------------------

/** A primitive painted one colour, or a gradient from `bottom` to `top` along its height. */
function painted(
  geometry: THREE.BufferGeometry,
  bottom: string,
  top: string = bottom,
): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeBoundingBox();
  const box = g.boundingBox as THREE.Box3;
  const low = new THREE.Color(bottom);
  const high = new THREE.Color(top);
  const position = g.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) - box.min.y) / Math.max(1e-6, box.max.y - box.min.y);
    c.copy(low).lerp(high, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute("uv");
  return g;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error("could not merge scenery geometry");
  geometry.computeVertexNormals();
  return geometry;
}

/** Rust-grass: a tuft of thin blades leaning outwards, dark at the root, golden at the tips. */
function grassGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const height = 0.32 + (i % 3) * 0.09;
    const blade = new THREE.ConeGeometry(0.025, height, 3);
    blade.translate(0, height / 2, 0);
    blade.rotateZ(0.25 + (i % 2) * 0.15);
    blade.rotateY((i / 6) * Math.PI * 2);
    blade.translate(Math.cos(i * 2.4) * 0.05, 0, Math.sin(i * 2.4) * 0.05);
    blades.push(painted(blade, "#6b3a22", "#e2a95e"));
  }
  return merged(blades);
}

/** Copperleaf: low, faceted bushes in copper, with a verdigris heart. */
function shrubGeometry(): THREE.BufferGeometry {
  const lobes = [
    [0, 0.16, 0, 0.2, "#a2552d"],
    [0.14, 0.12, 0.06, 0.15, "#b8663a"],
    [-0.1, 0.11, -0.1, 0.14, "#8f4a28"],
    [0.02, 0.24, -0.03, 0.11, "#4f8f7c"],
  ] as const;
  return merged(
    lobes.map(([x, y, z, radius, tint]) => {
      const lobe = new THREE.IcosahedronGeometry(radius, 0);
      lobe.scale(1, 0.75, 1);
      lobe.translate(x, y, z);
      return painted(lobe, tint);
    }),
  );
}

const LANTERN_HEIGHT = 0.95;

/** Lantern stalk: a slender stem with two curled leaves; its bulb is drawn separately. */
function lanternGeometry(): THREE.BufferGeometry {
  const stem = new THREE.CylinderGeometry(0.012, 0.025, LANTERN_HEIGHT, 5);
  stem.translate(0, LANTERN_HEIGHT / 2, 0);
  const leaves = [0, 1].map((i) => {
    const leaf = new THREE.ConeGeometry(0.05, 0.28, 3);
    leaf.rotateZ(i === 0 ? 1.0 : -1.0);
    leaf.translate(i === 0 ? -0.09 : 0.09, 0.3 + i * 0.18, 0);
    return painted(leaf, "#3a6a5c", "#69b39a");
  });
  return merged([painted(stem, "#2f2424", "#4a3a34"), ...leaves]);
}

function bulbGeometry(): THREE.BufferGeometry {
  const bulb = new THREE.SphereGeometry(0.07, 10, 8);
  bulb.scale(1, 1.3, 1);
  bulb.translate(0, LANTERN_HEIGHT + 0.04, 0);
  return painted(bulb, "#ffffff");
}

/** Parasol spire: a tall, thin trunk under two flat, rust-red canopies. */
function treeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.04, 0.09, 1.7, 6);
  trunk.translate(0, 0.85, 0);
  const upper = new THREE.CylinderGeometry(0.06, 0.62, 0.2, 7);
  upper.translate(0, 1.75, 0);
  const lower = new THREE.CylinderGeometry(0.05, 0.42, 0.16, 7);
  lower.rotateY(0.4);
  lower.translate(0.05, 1.32, -0.04);
  return merged([
    painted(trunk, "#3e2a24", "#6b4636"),
    painted(lower, "#8e3f26", "#b4583a"),
    painted(upper, "#a94b2e", "#d97a4a"),
  ]);
}

/** A weathered boulder: a lumpy, faceted stone. */
function rockGeometry(): THREE.BufferGeometry {
  const rock = new THREE.IcosahedronGeometry(0.3, 1);
  const position = rock.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(position, i);
    const bump =
      0.8 + hash(Math.round(v.x * 100), Math.round(v.z * 100), Math.round(v.y * 100)) * 0.35;
    v.multiplyScalar(bump);
    position.setXYZ(i, v.x * 1.1, Math.max(-0.05, v.y * 0.75), v.z);
  }
  rock.translate(0, 0.12, 0);
  return merged([painted(rock, "#4a3a37", "#7a6560")]);
}

/** A broken Tessilend column: pale stone with a verdigris band, snapped off at the top. */
function columnGeometry(): THREE.BufferGeometry {
  const base = new THREE.CylinderGeometry(0.34, 0.38, 0.18, 10);
  base.translate(0, 0.09, 0);
  const shaft = new THREE.CylinderGeometry(0.22, 0.25, 1.5, 10);
  shaft.translate(0, 0.93, 0);
  const band = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 10);
  band.translate(0, 0.55, 0);
  const shard = new THREE.CylinderGeometry(0.2, 0.22, 0.5, 10, 1, false, 0, Math.PI * 1.2);
  shard.rotateZ(1.3);
  shard.translate(0.55, 0.15, 0.2);
  return merged([
    painted(base, "#8f8476"),
    painted(shaft, "#a89b88", "#cbbfac"),
    painted(band, "#4f8a77"),
    painted(shard, "#a89b88"),
  ]);
}

/** A Tessilend arch, still standing, with nothing left to frame. */
function archGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const pillar = new THREE.BoxGeometry(0.3, 2.1, 0.3);
    pillar.translate(side * 0.75, 1.05, 0);
    parts.push(painted(pillar, "#958978", "#c2b6a3"));
  }
  const lintel = new THREE.BoxGeometry(2.0, 0.28, 0.36);
  lintel.translate(0, 2.2, 0);
  parts.push(painted(lintel, "#b5a995"));
  const inlay = new THREE.BoxGeometry(1.4, 0.06, 0.38);
  inlay.translate(0, 2.05, 0);
  parts.push(painted(inlay, "#4f8a77"));
  return merged(parts);
}

/** Wreckage from the Mind's ship: bent, dark hull plating. */
function debrisGeometry(): THREE.BufferGeometry {
  const plate = new THREE.BoxGeometry(0.5, 0.05, 0.28);
  plate.rotateZ(0.35);
  plate.rotateX(0.2);
  plate.translate(0, 0.08, 0);
  const strut = new THREE.BoxGeometry(0.06, 0.06, 0.45);
  strut.rotateY(0.6);
  strut.rotateX(-0.4);
  strut.translate(0.12, 0.1, 0.05);
  return merged([painted(plate, "#59606c", "#8a919c"), painted(strut, "#6a707a")]);
}

// --- Materials -----------------------------------------------------------------------------------

/**
 * A material whose geometry bends in the wind: the higher up a vertex is, the further it
 * sways. The phase comes from world position, so gusts roll across a field in waves.
 */
function swaying(strength: number, options: THREE.MeshStandardNodeMaterialParameters = {}) {
  const material = new THREE.MeshStandardNodeMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    ...options,
  });
  const phase = positionLocal.x.mul(0.35).add(positionLocal.z.mul(0.25));
  const gust = sin(time.mul(0.35)).mul(0.35).add(0.75);
  const bend = positionGeometry.y.mul(strength).mul(gust);
  material.positionNode = positionLocal.add(
    vec3(
      sin(time.mul(1.6).add(phase)).mul(bend),
      float(0),
      cos(time.mul(1.25).add(phase.mul(1.7)))
        .mul(bend)
        .mul(0.6),
    ),
  );
  return material;
}

function solid(options: THREE.MeshStandardNodeMaterialParameters = {}) {
  return new THREE.MeshStandardNodeMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
    ...options,
  });
}

/** Lantern bulbs breathe softly, each a little out of step with its neighbours. */
function bulbMaterial() {
  const material = swaying(0.09, { roughness: 0.4 });
  const phase = positionLocal.x.mul(1.3).add(positionLocal.z.mul(0.7));
  material.emissiveNode = color("#5ff0c6").mul(sin(time.mul(1.7).add(phase)).mul(0.55).add(1.4));
  return material;
}

interface Layer {
  mesh: THREE.InstancedMesh;
  /** Whether the item's own colour is dimmed in the fog. */
  dims: boolean;
}

const CAPACITY: Record<DecorKind, number> = {
  grass: 9000,
  shrub: 3000,
  lantern: 2500,
  bulb: 2500,
  tree: 2500,
  rock: 5000,
  column: 300,
  arch: 200,
  debris: 600,
};

/** Brightness of scenery on explored ground nobody can currently see. */
const FOGGED = 0.35;

/** All scenery, as one instanced mesh per kind, rebuilt when what's on screen changes. */
export class Scenery {
  readonly group = new THREE.Group();
  private readonly layers = new Map<DecorKind, Layer>();
  private readonly cache = new WeakMap<Chunk, DecorItem[]>();
  private shown = "";

  constructor(private readonly world: World) {
    const add = (
      kind: DecorKind,
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      dims = true,
    ) => {
      const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY[kind]);
      mesh.count = 0;
      // Create the colour buffer up front, so the shader is built with per-instance colour.
      mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      mesh.castShadow = kind !== "grass";
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // spread over many chunks; the bounds would be stale anyway
      this.group.add(mesh);
      this.layers.set(kind, { mesh, dims });
    };
    add("grass", grassGeometry(), swaying(0.12));
    add("shrub", shrubGeometry(), swaying(0.05, { flatShading: true }));
    add("lantern", lanternGeometry(), swaying(0.09));
    add("bulb", bulbGeometry(), bulbMaterial(), false);
    add("tree", treeGeometry(), swaying(0.025, { flatShading: true }));
    add("rock", rockGeometry(), solid());
    add("column", columnGeometry(), solid({ roughness: 0.75 }));
    add("arch", archGeometry(), solid({ roughness: 0.75 }));
    add("debris", debrisGeometry(), solid({ metalness: 0.25, roughness: 0.5 }));
  }

  private itemsOf(chunk: Chunk): DecorItem[] {
    let items = this.cache.get(chunk);
    if (!items) {
      items = generateDecor(this.world, chunk);
      this.cache.set(chunk, items);
    }
    return items;
  }

  /** Show the scenery of these chunks: explored tiles only, hidden under buildings. */
  update(chunks: readonly Chunk[]): void {
    const key = chunks.map((c) => `${c.x},${c.y}:${c.version}`).join("|");
    if (key === this.shown) return;
    this.shown = key;

    const counts = new Map<DecorKind, number>();
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tint = new THREE.Color();

    for (const chunk of chunks) {
      for (const item of this.itemsOf(chunk)) {
        if (chunk.explored[item.tile] !== 1 || (chunk.occupied[item.tile] ?? 0) > 0) continue;
        const layer = this.layers.get(item.kind);
        if (!layer) continue;
        const index = counts.get(item.kind) ?? 0;
        if (index >= CAPACITY[item.kind]) continue;
        counts.set(item.kind, index + 1);

        position.set(item.x, item.height, item.y);
        rotation.setFromAxisAngle(up, item.rotation);
        scale.setScalar(item.scale);
        matrix.compose(position, rotation, scale);
        layer.mesh.setMatrixAt(index, matrix);

        const seen = (chunk.watchers[item.tile] ?? 0) > 0;
        const brightness = item.shade * (layer.dims && !seen ? FOGGED : 1);
        layer.mesh.setColorAt(index, tint.setScalar(brightness));
      }
    }

    for (const [kind, layer] of this.layers) {
      layer.mesh.count = counts.get(kind) ?? 0;
      layer.mesh.instanceMatrix.needsUpdate = true;
      if (layer.mesh.instanceColor) layer.mesh.instanceColor.needsUpdate = true;
    }
  }
}
