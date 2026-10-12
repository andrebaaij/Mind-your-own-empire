/**
 * Lessuin's wildlife. None of it matters to the game: animals never block anything and nothing
 * can hurt them. But they live there, and they mind the drones.
 *
 * - Trundlers: six-legged grazers in small herds. They graze, amble, and bolt from drones.
 * - Kites: manta-winged gliders that circle over the groves in flocks.
 * - Longshanks: enormous, slow striders that cross the far country and ignore everyone.
 *
 * Only animals near the camera are simulated. When one wanders too far from the view, it is
 * moved somewhere out of sight nearby, so the land around you is never empty.
 */

import alea from "alea";
import { distance, gridFromWorld, type Point } from "./coords";
import { START_CENTER, Terrain } from "./terrain";
import { isMobile, type Unit } from "./units";
import type { World } from "./world";

export type GrazerMood = "graze" | "amble" | "flee";

export interface Grazer {
  position: Point;
  /** Direction faced, in radians on the ground plane (0 = +x). */
  heading: number;
  /** Current speed in tiles per second, for animating the gait. */
  speed: number;
  mood: GrazerMood;
  /** Seconds left in the current mood. */
  timer: number;
  /** Walk cycle phase, advanced by distance travelled. */
  gait: number;
  /** Where in the herd this animal likes to be, relative to the herd's goal. */
  offset: Point;
  size: number;
}

export interface Herd {
  goal: Point;
  /** Seconds until the herd picks somewhere new to graze. */
  timer: number;
  grazers: Grazer[];
}

export interface Kite {
  /** Orbit around the flock's centre. */
  radius: number;
  angle: number;
  angularSpeed: number;
  altitude: number;
  /** Phase for bobbing and flapping. */
  phase: number;
  size: number;
}

export interface Flock {
  center: Point;
  goal: Point;
  timer: number;
  kites: Kite[];
  /** Briefly scattered (wider, faster orbits) after a drone flew through. */
  startle: number;
}

export interface Longshank {
  position: Point;
  heading: number;
  gait: number;
}

/** How close a drone can get before trundlers bolt. */
export const FLEE_RADIUS = 4.5;
const GRAZE_SPEED = 0;
const AMBLE_SPEED = 0.55;
const FLEE_SPEED = 2.8;
/** Trundlers turn this fast (radians per second), so they don't spin on the spot. */
const TURN_RATE = 4;

const HERDS = 5;
const FLOCKS = 3;
/** Animals further than this from the camera's focus are moved closer. */
const LEASH = 65;
/** New animals appear in this ring around the focus. */
const SPAWN_MIN = 18;
const SPAWN_MAX = 48;
/** The crash site and base are too busy for wildlife to settle. */
const BASE_CLEARANCE = 12;
const LONGSHANK_SPEED = 0.7;
/** Longshanks keep this far from the base: they're shy, or at least uninterested. */
const LONGSHANK_CLEARANCE = 22;

export class Fauna {
  readonly herds: Herd[] = [];
  readonly flocks: Flock[] = [];
  longshank: Longshank | null = null;
  private readonly random: () => number;

  constructor(
    private readonly world: World,
    seed = "fauna",
  ) {
    this.random = alea(seed);
  }

  /** Whether a trundler can stand here: on solid, open ground, not in the base. */
  canGraze(point: Point): boolean {
    const grid = gridFromWorld(point);
    if (!this.world.isPassable(grid)) return false;
    if (distance(point, START_CENTER) < BASE_CLEARANCE) return false;
    const chunk = this.world.getChunk(grid.chunkX, grid.chunkY);
    return chunk.cliffs[grid.i] !== 1 && chunk.tiles[grid.i] !== Terrain.Acid;
  }

  private canStep(from: Point, to: Point): boolean {
    if (!this.canGraze(to)) return false;
    return this.world.canClimb(gridFromWorld(from), gridFromWorld(to));
  }

  private range(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  /** A grazing spot in the ring around `focus`, preferably where the player can't see it. */
  private spawnPoint(focus: Point, min = SPAWN_MIN, max = SPAWN_MAX): Point | null {
    let fallback: Point | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = this.random() * Math.PI * 2;
      const reach = this.range(min, max);
      const point = { x: focus.x + Math.cos(angle) * reach, y: focus.y + Math.sin(angle) * reach };
      if (!this.canGraze(point)) continue;
      if (!this.world.isVisible(gridFromWorld(point))) return point;
      fallback ??= point;
    }
    return fallback;
  }

  private createHerd(at: Point): Herd {
    const count = 3 + Math.floor(this.random() * 4);
    const grazers: Grazer[] = [];
    for (let i = 0; i < count; i++) {
      const offset = { x: this.range(-1.8, 1.8), y: this.range(-1.8, 1.8) };
      const position = { x: at.x + offset.x, y: at.y + offset.y };
      grazers.push({
        position: this.canGraze(position) ? position : { ...at },
        heading: this.random() * Math.PI * 2,
        speed: 0,
        mood: "graze",
        timer: this.range(0, 4),
        gait: this.random() * Math.PI * 2,
        offset,
        // A youngster or two in most herds.
        size: i === count - 1 && count > 3 ? 0.6 : this.range(0.9, 1.15),
      });
    }
    return { goal: { ...at }, timer: this.range(10, 25), grazers };
  }

  private createFlock(at: Point): Flock {
    const count = 6 + Math.floor(this.random() * 7);
    const kites: Kite[] = [];
    for (let i = 0; i < count; i++) {
      kites.push({
        radius: this.range(2, 6),
        angle: this.random() * Math.PI * 2,
        angularSpeed: this.range(0.35, 0.6) * (this.random() < 0.85 ? 1 : -1),
        altitude: this.range(2.5, 5),
        phase: this.random() * Math.PI * 2,
        size: this.range(0.8, 1.2),
      });
    }
    return { center: { ...at }, goal: { ...at }, timer: this.range(15, 35), kites, startle: 0 };
  }

  /** The herd's middle, from where its animals actually are. */
  static herdCenter(herd: Herd): Point {
    const n = herd.grazers.length || 1;
    return {
      x: herd.grazers.reduce((sum, g) => sum + g.position.x, 0) / n,
      y: herd.grazers.reduce((sum, g) => sum + g.position.y, 0) / n,
    };
  }

  /** Advance the wildlife by `dt` seconds, around the point the camera looks at. */
  update(units: readonly Unit[], focus: Point, dt: number): void {
    this.populate(focus);
    const drones = units.filter(isMobile).map((unit) => unit.position);
    for (const herd of this.herds) this.updateHerd(herd, drones, dt);
    for (const flock of this.flocks) this.updateFlock(flock, drones, focus, dt);
    this.updateLongshank(focus, dt);
  }

  /** Keep a few herds and flocks near the view, moving stragglers back into range. */
  private populate(focus: Point): void {
    for (let i = 0; i < this.herds.length; i++) {
      const herd = this.herds[i];
      if (!herd || distance(Fauna.herdCenter(herd), focus) < LEASH) continue;
      const at = this.spawnPoint(focus);
      if (at) this.herds[i] = this.createHerd(at);
    }
    while (this.herds.length < HERDS) {
      const at = this.spawnPoint(focus);
      if (!at) break;
      this.herds.push(this.createHerd(at));
    }

    for (let i = 0; i < this.flocks.length; i++) {
      const flock = this.flocks[i];
      if (!flock || distance(flock.center, focus) < LEASH) continue;
      const at = this.spawnPoint(focus);
      if (at) this.flocks[i] = this.createFlock(at);
    }
    while (this.flocks.length < FLOCKS) {
      const at = this.spawnPoint(focus);
      if (!at) break;
      this.flocks.push(this.createFlock(at));
    }
  }

  private updateHerd(herd: Herd, drones: readonly Point[], dt: number): void {
    herd.timer -= dt;
    if (herd.timer <= 0) {
      // Drift to new pasture nearby.
      herd.timer = this.range(12, 30);
      const center = Fauna.herdCenter(herd);
      const next = this.spawnPoint(center, 3, 10);
      if (next) herd.goal = next;
    }
    for (const grazer of herd.grazers) this.updateGrazer(herd, grazer, drones, dt);
  }

  private updateGrazer(herd: Herd, grazer: Grazer, drones: readonly Point[], dt: number): void {
    // Bolt from the nearest drone that comes too close.
    let threat: Point | null = null;
    let nearest = FLEE_RADIUS;
    for (const drone of drones) {
      const d = distance(drone, grazer.position);
      if (d < nearest) {
        nearest = d;
        threat = drone;
      }
    }

    let desired = grazer.heading;
    if (threat) {
      grazer.mood = "flee";
      grazer.timer = this.range(1.5, 2.5);
      desired = Math.atan2(grazer.position.y - threat.y, grazer.position.x - threat.x);
    } else {
      grazer.timer -= dt;
      if (grazer.timer <= 0) {
        // After fleeing, or now and then, wander back towards its place in the herd.
        grazer.mood = grazer.mood !== "amble" && this.random() < 0.45 ? "amble" : "graze";
        grazer.timer = grazer.mood === "amble" ? this.range(2, 5) : this.range(2.5, 7);
      }
      if (grazer.mood === "amble") {
        const target = { x: herd.goal.x + grazer.offset.x, y: herd.goal.y + grazer.offset.y };
        if (distance(target, grazer.position) < 0.3) {
          grazer.mood = "graze";
        } else {
          desired = Math.atan2(target.y - grazer.position.y, target.x - grazer.position.x);
        }
      }
    }

    // Turn towards where it wants to go, then move if facing roughly that way.
    const diff = Math.atan2(Math.sin(desired - grazer.heading), Math.cos(desired - grazer.heading));
    const turn = Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);
    grazer.heading += turn;

    const speed =
      grazer.mood === "flee" ? FLEE_SPEED : grazer.mood === "amble" ? AMBLE_SPEED : GRAZE_SPEED;
    const facing = Math.abs(diff) < 1.2 ? 1 : 0.2;
    const step = speed * facing * dt * (0.7 + grazer.size * 0.3);
    grazer.speed = step / Math.max(dt, 1e-6);
    if (step <= 0) return;

    const next = {
      x: grazer.position.x + Math.cos(grazer.heading) * step,
      y: grazer.position.y + Math.sin(grazer.heading) * step,
    };
    if (this.canStep(grazer.position, next)) {
      grazer.position = next;
      grazer.gait += (step / (0.35 * grazer.size)) * Math.PI;
    } else {
      // Acid, a cliff or a building ahead: turn aside.
      grazer.heading += (this.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + this.random());
      grazer.speed = 0;
    }
  }

  private updateFlock(flock: Flock, drones: readonly Point[], focus: Point, dt: number): void {
    flock.timer -= dt;
    if (flock.timer <= 0) {
      flock.timer = this.range(15, 35);
      const next = this.spawnPoint(focus, 10, SPAWN_MAX);
      if (next) flock.goal = next;
    }
    // Glide slowly towards the next place to circle.
    const dx = flock.goal.x - flock.center.x;
    const dy = flock.goal.y - flock.center.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.1) {
      const step = Math.min(d, 1.2 * dt);
      flock.center.x += (dx / d) * step;
      flock.center.y += (dy / d) * step;
    }
    if (drones.some((drone) => distance(drone, flock.center) < 5)) flock.startle = 1;
    flock.startle = Math.max(0, flock.startle - dt * 0.25);
    for (const kite of flock.kites) {
      kite.angle += kite.angularSpeed * (1 + flock.startle * 1.5) * dt;
      kite.phase += dt * (2.2 + flock.startle * 4);
    }
  }

  /** Where a kite is right now: its ground position and its height above the ground. */
  static kitePosition(flock: Flock, kite: Kite): { point: Point; altitude: number } {
    const spread = 1 + flock.startle * 0.8;
    return {
      point: {
        x: flock.center.x + Math.cos(kite.angle) * kite.radius * spread,
        y: flock.center.y + Math.sin(kite.angle) * kite.radius * spread,
      },
      altitude: kite.altitude + Math.sin(kite.phase * 0.4) * 0.5 + flock.startle,
    };
  }

  /** At most one longshank at a time, walking a long straight line past the view. */
  private updateLongshank(focus: Point, dt: number): void {
    const strider = this.longshank;
    if (!strider || distance(strider.position, focus) > LEASH + 25) {
      // Start beyond the view, heading across it (but not through the base).
      const angle = this.random() * Math.PI * 2;
      const start = {
        x: focus.x + Math.cos(angle) * (LEASH + 10),
        y: focus.y + Math.sin(angle) * (LEASH + 10),
      };
      const heading = angle + Math.PI + this.range(-0.5, 0.5);
      this.longshank = { position: start, heading, gait: 0 };
      return;
    }
    const step = LONGSHANK_SPEED * dt;
    const next = {
      x: strider.position.x + Math.cos(strider.heading) * step,
      y: strider.position.y + Math.sin(strider.heading) * step,
    };
    if (distance(next, START_CENTER) < LONGSHANK_CLEARANCE) {
      // Veer around the base, unhurried.
      const away = Math.atan2(next.y - START_CENTER.y, next.x - START_CENTER.x);
      strider.heading = away + Math.PI / 2;
      return;
    }
    strider.position = next;
    strider.gait += step * 0.9;
  }
}
