/**
 * Procedural models for Lessuin's wildlife (see fauna.ts) and the code that poses them each
 * frame: trundlers walk on a six-legged tripod gait, kites flap and bank, and the longshank's
 * stilt legs plant and lift as it strides.
 */

import * as THREE from "three/webgpu";
import { gridFromWorld, type Point } from "./coords";
import { Fauna, type Flock, type Grazer, type Kite, type Longshank } from "./fauna";
import type { World } from "./world";

export type CreatureKind = "trundler" | "kite" | "longshank";

/** What the Mind says the first time the player sees each animal. */
export const FIRST_SIGHTING: Record<CreatureKind, string> = {
  trundler:
    "Six legs, armour plating, and absolutely no interest in us. I'm calling them trundlers. Try not to run them over.",
  kite: "Something's flying over the groves. Not ours, not the Custody's. Kites, I think. They seem to be doing it for fun.",
  longshank:
    "Please don't be alarmed by the very large animal. I've named it a longshank, and I intend to be extremely polite to it.",
};

// Slate-blue plates with a verdigris sheen: they stand out from the rust, like everything
// living here that wasn't made of it.
const plate = new THREE.MeshStandardMaterial({ color: "#56646e", roughness: 0.45, metalness: 0.3 });
const ridgePlate = new THREE.MeshStandardMaterial({ color: "#5fa38c", roughness: 0.5 });
const belly = new THREE.MeshStandardMaterial({ color: "#d9c1a0", roughness: 0.85 });
const limb = new THREE.MeshStandardMaterial({ color: "#3b2a26", roughness: 0.8 });
const eye = new THREE.MeshStandardMaterial({
  color: "#ffd27a",
  emissive: "#ffb347",
  emissiveIntensity: 2.5,
});
const membrane = new THREE.MeshStandardMaterial({
  color: "#e0844e",
  roughness: 0.5,
  side: THREE.DoubleSide,
  emissive: "#5a1e0c",
  emissiveIntensity: 0.6,
});
const bone = new THREE.MeshStandardMaterial({ color: "#d8cdb8", roughness: 0.7 });
const band = new THREE.MeshStandardMaterial({ color: "#4a3a3a", roughness: 0.7 });
const lure = new THREE.MeshStandardMaterial({
  color: "#9affe0",
  emissive: "#5ff0c6",
  emissiveIntensity: 3,
});

function part(geometry: THREE.BufferGeometry, material: THREE.Material, shadow = true): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = shadow;
  return mesh;
}

/** Trundlers are about the size of a worker drone; kites have a wingspan of a couple of tiles. */
const TRUNDLER_SCALE = 1.5;
const KITE_SCALE = 2.2;

// --- Trundler ------------------------------------------------------------------------------------

interface TrundlerModel {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  /** Hip pivots, in tripod order: the first three step together, then the other three. */
  legs: THREE.Group[];
}

const legGeometry = new THREE.CylinderGeometry(0.018, 0.012, 0.19, 5).translate(0, -0.095, 0);

/** A trundler, facing +x: a low, plated hexapod with a cream belly and two amber eyes. */
function trundler(): TrundlerModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.17;
  root.add(body);

  const shell = part(new THREE.SphereGeometry(0.2, 10, 7), plate);
  shell.scale.set(1.45, 0.7, 1.05);
  shell.position.y = 0.03;
  const underside = part(new THREE.SphereGeometry(0.19, 10, 6), belly);
  underside.scale.set(1.35, 0.45, 0.9);
  underside.position.y = -0.03;
  body.add(shell, underside);
  // Ridge plates down the back.
  for (const [x, s] of [
    [-0.16, 0.8],
    [0, 1],
    [0.14, 0.85],
  ] as const) {
    const ridge = part(new THREE.ConeGeometry(0.05 * s, 0.09 * s, 4), ridgePlate);
    ridge.position.set(x, 0.17, 0);
    ridge.rotation.y = Math.PI / 4;
    body.add(ridge);
  }

  const head = new THREE.Group();
  head.position.set(0.27, 0.0, 0);
  const skull = part(new THREE.SphereGeometry(0.09, 8, 6), plate);
  skull.scale.set(1.2, 0.85, 1);
  head.add(skull);
  for (const side of [-1, 1]) {
    const e = part(new THREE.SphereGeometry(0.018, 6, 4), eye, false);
    e.position.set(0.08, 0.03, side * 0.045);
    head.add(e);
  }
  body.add(head);

  const legs: THREE.Group[] = [];
  // Tripods: front-left, middle-right, back-left; then front-right, middle-left, back-right.
  const hips: [number, number][] = [
    [0.16, -1],
    [0, 1],
    [-0.16, -1],
    [0.16, 1],
    [0, -1],
    [-0.16, 1],
  ];
  for (const [x, side] of hips) {
    const hip = new THREE.Group();
    hip.position.set(x, -0.02, side * 0.15);
    hip.rotation.x = side * 0.5; // splayed outwards
    hip.add(part(legGeometry, limb, false));
    body.add(hip);
    legs.push(hip);
  }
  return { root, body, head, legs };
}

function poseTrundler(model: TrundlerModel, grazer: Grazer, time: number): void {
  const moving = grazer.speed > 0.05;
  const swing = moving ? Math.min(0.6, 0.25 + grazer.speed * 0.12) : 0;
  model.legs.forEach((leg, i) => {
    const phase = grazer.gait + (i < 3 ? 0 : Math.PI);
    leg.rotation.z = Math.sin(phase) * swing;
  });
  // A little bounce in the step, and a crouch when bolting.
  const bounce = moving ? Math.abs(Math.cos(grazer.gait)) * 0.02 : 0;
  model.body.position.y = 0.17 + bounce - (grazer.mood === "flee" ? 0.02 : 0);
  model.body.rotation.z = grazer.mood === "flee" ? -0.12 : 0;
  // Grazing: the head dips to the ground, comes up to look around, and dips again.
  const nibble =
    grazer.mood === "graze" ? Math.max(0, Math.sin(time * 0.9 + grazer.offset.x * 3)) : 0;
  model.head.rotation.z = -nibble * 0.7;
  model.head.position.y = -nibble * 0.06;
}

// --- Kite ----------------------------------------------------------------------------------------

interface KiteModel {
  root: THREE.Group;
  wings: [THREE.Object3D, THREE.Object3D];
}

function wingGeometry(): THREE.BufferGeometry {
  // A swept triangle from the body out to the tip, along +z.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0.12, 0, 0, -0.14, 0, 0, -0.12, 0, 0.42], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** A kite, facing +x: a slim body between two broad, sunset-coloured membranes. */
function kite(): KiteModel {
  const root = new THREE.Group();
  const body = part(new THREE.ConeGeometry(0.035, 0.32, 5), band);
  body.rotation.z = -Math.PI / 2;
  const tail = part(new THREE.CylinderGeometry(0.004, 0.012, 0.3, 4), band, false);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -0.28;
  const glow = part(new THREE.SphereGeometry(0.02, 6, 4), lure, false);
  glow.position.x = -0.43;
  root.add(body, tail, glow);

  const geometry = wingGeometry();
  const left = new THREE.Group();
  const right = new THREE.Group();
  left.add(part(geometry, membrane));
  const mirrored = part(geometry, membrane);
  mirrored.scale.z = -1;
  right.add(mirrored);
  root.add(left, right);
  return { root, wings: [left, right] };
}

function poseKite(model: KiteModel, flock: Flock, data: Kite, world: World): void {
  const { point, altitude } = Fauna.kitePosition(flock, data);
  model.root.position.set(point.x, world.heightAt(point.x, point.y) + altitude, point.y);
  // Fly along the orbit, banking into the turn.
  const direction = data.angle + (data.angularSpeed > 0 ? Math.PI / 2 : -Math.PI / 2);
  model.root.rotation.set(0, -direction, 0);
  model.root.rotateX(data.angularSpeed > 0 ? 0.35 : -0.35);
  model.root.scale.setScalar(data.size * KITE_SCALE);
  // Mostly gliding, with bursts of flapping.
  const burst = Math.max(0, Math.sin(data.phase * 0.3));
  const flap = Math.sin(data.phase * 4) * 0.7 * burst + 0.12;
  model.wings[0].rotation.x = -flap;
  model.wings[1].rotation.x = flap;
}

// --- Longshank -----------------------------------------------------------------------------------

const HIP_HEIGHT = 5.2;
const STRIDE = 2.6;
const segmentGeometry = new THREE.CylinderGeometry(0.06, 0.08, 1, 6).translate(0, 0.5, 0);
const UP = new THREE.Vector3(0, 1, 0);

interface LongshankModel {
  root: THREE.Group;
  body: THREE.Group;
  /** Two segments per leg: thigh then shin. */
  segments: THREE.Mesh[];
}

/** A longshank: a pale, banded body slung between four enormous stilt legs, a lure dangling. */
function longshank(): LongshankModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const hull = part(new THREE.SphereGeometry(0.9, 14, 10), bone);
  hull.scale.set(1.8, 0.8, 0.9);
  body.add(hull);
  for (const x of [-0.8, 0, 0.8]) {
    const stripe = part(new THREE.TorusGeometry(0.72, 0.07, 6, 18), band);
    stripe.rotation.y = Math.PI / 2;
    stripe.position.x = x;
    stripe.scale.set(1, 0.85, 1);
    body.add(stripe);
  }
  const neck = part(new THREE.CylinderGeometry(0.05, 0.1, 1.6, 6), bone);
  neck.position.set(1.85, -0.55, 0);
  neck.rotation.z = 0.9;
  const head = part(new THREE.SphereGeometry(0.28, 10, 8), bone);
  head.scale.set(1.4, 0.8, 0.9);
  head.position.set(2.45, -1.05, 0);
  const light = part(new THREE.SphereGeometry(0.1, 8, 6), lure, false);
  light.position.set(2.6, -1.9, 0);
  const tether = part(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4), band, false);
  tether.position.set(2.6, -1.5, 0);
  body.add(neck, head, light, tether);
  root.add(body);

  const segments: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const segment = part(segmentGeometry, bone);
    root.add(segment);
    segments.push(segment);
  }
  return { root, body, segments };
}

/** Stretch a unit-tall segment between two points. */
function span(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
  const direction = to.clone().sub(from);
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(UP, direction.clone().normalize());
  mesh.scale.set(1, direction.length(), 1);
}

function poseLongshank(model: LongshankModel, strider: Longshank, world: World): void {
  const { position, heading } = strider;
  const ground = world.heightAt(position.x, position.y);
  const cycle = (strider.gait / STRIDE) * Math.PI * 2;
  model.root.position.set(position.x, ground, position.y);
  model.root.rotation.y = -heading;
  model.body.position.y = HIP_HEIGHT + 0.6 + Math.sin(cycle * 2) * 0.12;
  model.body.rotation.z = Math.sin(cycle) * 0.03;

  // Diagonal pairs move together. Each foot sweeps back while planted, then lifts and swings.
  const legs: [number, number, number][] = [
    [1.2, 1, 0],
    [-1.2, -1, 0],
    [1.2, -1, Math.PI],
    [-1.2, 1, Math.PI],
  ];
  const forward = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading));
  legs.forEach(([x, side, offset], i) => {
    const phase = cycle + offset;
    const reach = Math.sin(phase) * (STRIDE / 2);
    const lift = Math.max(0, Math.cos(phase)) * 0.7;
    const hip = new THREE.Vector3(x, model.body.position.y - 0.2, side * 0.6);
    const foot = new THREE.Vector3(x * 1.6 + reach, 0, side * 2.2);
    // Feet rest on the ground where they land, in the model's frame.
    const world2d: Point = {
      x: position.x + forward.x * foot.x - forward.z * foot.z,
      y: position.y + forward.z * foot.x + forward.x * foot.z,
    };
    foot.y = world.heightAt(world2d.x, world2d.y) - ground + lift;
    // The knee rises high above the body, like a harvestman's.
    const knee = hip.clone().lerp(foot, 0.35);
    knee.y = HIP_HEIGHT + 2.2;
    knee.z += side * 0.6;
    const thigh = model.segments[i * 2];
    const shin = model.segments[i * 2 + 1];
    if (thigh) span(thigh, hip, knee);
    if (shin) span(shin, knee, foot);
  });
}

// --- View ----------------------------------------------------------------------------------------

function angleLerp(from: number, to: number, t: number): number {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
}

/** Draws the wildlife: where the player has eyes for small animals, and anywhere explored for
 *  the longshank, which stands tall enough to be seen over the haze. */
export class CreatureView {
  readonly group = new THREE.Group();
  private readonly trundlers: TrundlerModel[] = [];
  private readonly headings = new WeakMap<Grazer, number>();
  private readonly kites: KiteModel[] = [];
  private readonly longshank = longshank();

  constructor(private readonly world: World) {
    this.longshank.root.visible = false;
    this.group.add(this.longshank.root);
  }

  /** Pose every animal; returns the kinds the player can see right now. */
  update(fauna: Fauna, time: number): Set<CreatureKind> {
    const seen = new Set<CreatureKind>();
    const visible = (point: Point) => this.world.isVisible(gridFromWorld(point));

    let t = 0;
    for (const herd of fauna.herds) {
      for (const grazer of herd.grazers) {
        let model = this.trundlers[t];
        if (!model) {
          model = trundler();
          this.trundlers.push(model);
          this.group.add(model.root);
        }
        t++;
        const shown = visible(grazer.position);
        model.root.visible = shown;
        if (!shown) continue;
        seen.add("trundler");
        const { x, y } = grazer.position;
        model.root.position.set(x, this.world.heightAt(x, y), y);
        const heading = angleLerp(
          this.headings.get(grazer) ?? grazer.heading,
          grazer.heading,
          0.25,
        );
        this.headings.set(grazer, heading);
        model.root.rotation.y = -heading;
        model.root.scale.setScalar(grazer.size * TRUNDLER_SCALE);
        poseTrundler(model, grazer, time);
      }
    }
    for (let i = t; i < this.trundlers.length; i++) {
      const model = this.trundlers[i];
      if (model) model.root.visible = false;
    }

    let k = 0;
    for (const flock of fauna.flocks) {
      for (const data of flock.kites) {
        let model = this.kites[k];
        if (!model) {
          model = kite();
          this.kites.push(model);
          this.group.add(model.root);
        }
        k++;
        const shown = visible(Fauna.kitePosition(flock, data).point);
        model.root.visible = shown;
        if (!shown) continue;
        seen.add("kite");
        poseKite(model, flock, data, this.world);
      }
    }
    for (let i = k; i < this.kites.length; i++) {
      const model = this.kites[i];
      if (model) model.root.visible = false;
    }

    const strider = fauna.longshank;
    const tall = strider !== null && this.world.isExplored(gridFromWorld(strider.position));
    this.longshank.root.visible = tall;
    if (strider && tall) {
      poseLongshank(this.longshank, strider, this.world);
      if (this.world.isVisible(gridFromWorld(strider.position))) seen.add("longshank");
    }
    return seen;
  }
}
