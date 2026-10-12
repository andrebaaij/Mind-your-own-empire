/**
 * Visual feedback for game events: sparks when drones mine, dust when things go up, debris when
 * they come down, rings when a site wakes or a ship lands, and floating numbers when a load comes
 * home. Everything is pooled, so a busy base costs no more than a quiet one.
 */

import * as THREE from "three/webgpu";
import type { Point } from "./coords";
import { gridFromWorld } from "./coords";
import type { GameEvent } from "./events";
import type { World } from "./world";

const MAX_PARTICLES = 700;
const MAX_RINGS = 16;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  color: THREE.Color;
  gravity: number;
}

interface Ring {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  size: number;
}

interface Floater {
  element: HTMLElement;
  at: THREE.Vector3;
  age: number;
}

const COLORS = {
  bloom: new THREE.Color("#ffab5e"),
  lattice: new THREE.Color("#7ff0cc"),
  dust: new THREE.Color("#8a5a44"),
  debris: new THREE.Color("#5a4a44"),
  amber: new THREE.Color("#ffb347"),
  idiran: new THREE.Color("#ff4a2a"),
  glow: new THREE.Color("#5fe0b8"),
  white: new THREE.Color("#fff3df"),
};

export class Effects {
  readonly group = new THREE.Group();
  /** How hard the camera should shake right now; the renderer reads and decays it. */
  shake = 0;
  private readonly particles: Particle[] = [];
  private readonly mesh: THREE.InstancedMesh;
  private readonly rings: Ring[] = [];
  private readonly floaters: Floater[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();

  constructor(
    private readonly world: World,
    private readonly overlay: HTMLElement,
  ) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.07, 0),
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      MAX_PARTICLES,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.group.add(this.mesh);

    const geometry = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_RINGS; i++) {
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, material, age: 1, life: 1, size: 1 });
    }
  }

  private ground(at: Point, lift = 0): THREE.Vector3 {
    return new THREE.Vector3(at.x, this.world.heightAt(at.x, at.y) + lift, at.y);
  }

  private seen(at: Point): boolean {
    return this.world.isVisible(gridFromWorld(at));
  }

  /** Throw `count` particles out of a point. */
  burst(
    at: THREE.Vector3,
    count: number,
    color: THREE.Color,
    options: { speed?: number; up?: number; life?: number; size?: number; gravity?: number } = {},
  ): void {
    const { speed = 1.5, up = 2, life = 0.8, size = 1, gravity = 4 } = options;
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const outward = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        position: at.clone(),
        velocity: new THREE.Vector3(
          Math.cos(angle) * outward,
          up * (0.5 + Math.random() * 0.8),
          Math.sin(angle) * outward,
        ),
        age: 0,
        life: life * (0.6 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        color: color.clone().multiplyScalar(0.8 + Math.random() * 0.6),
        gravity,
      });
    }
  }

  /** An expanding, fading ring on the ground. */
  ring(at: THREE.Vector3, color: THREE.Color, size: number, life = 0.9): void {
    const ring = this.rings.find((r) => r.age >= r.life) ?? this.rings[0];
    if (!ring) return;
    ring.age = 0;
    ring.life = life;
    ring.size = size;
    ring.material.color.copy(color);
    ring.mesh.position.copy(at).setY(at.y + 0.08);
    ring.mesh.visible = true;
  }

  /** A number or word that rises from a point and fades. */
  float(at: THREE.Vector3, text: string, tone: "bloom" | "lattice" | "info" = "info"): void {
    const element = document.createElement("div");
    element.className = `floater ${tone}`;
    element.textContent = text;
    this.overlay.append(element);
    this.floaters.push({ element, at: at.clone(), age: 0 });
  }

  /** React to what happened in the game since the last frame. */
  handle(events: readonly GameEvent[]): void {
    for (const event of events) {
      switch (event.kind) {
        case "mined":
          if (!this.seen(event.at)) break;
          this.burst(
            this.ground(event.at, 0.25),
            4,
            COLORS[event.resource === "iron" ? "bloom" : "lattice"],
            {
              speed: 1.2,
              up: 1.6,
              life: 0.45,
              size: 0.8,
            },
          );
          break;
        case "delivered":
          this.burst(
            this.ground(event.at, 1.2),
            8,
            COLORS[event.resource === "iron" ? "bloom" : "lattice"],
            {
              speed: 0.8,
              up: 1.2,
              life: 0.6,
              gravity: 1,
            },
          );
          this.float(
            this.ground(event.at, 2.2),
            `+${event.amount} ${event.resource === "iron" ? "bloom" : "lattice"}`,
            event.resource === "iron" ? "bloom" : "lattice",
          );
          break;
        case "built":
          this.burst(this.ground(event.at, 0.1), 18, COLORS.dust, {
            speed: 2.2,
            up: 1.2,
            life: 0.9,
            size: 1.3,
          });
          this.ring(this.ground(event.at), COLORS.glow, 1.8, 0.7);
          this.shake = Math.max(this.shake, 0.08);
          break;
        case "removed": {
          if (event.why === "left" || !this.seen(event.at)) break;
          const at = this.ground(event.at, 0.4);
          if (event.why === "escorted") {
            this.ring(this.ground(event.at), COLORS.amber, 2.2, 1.1);
            this.burst(at, 20, COLORS.amber, { speed: 0.6, up: 3.5, life: 1.2, gravity: -0.5 });
          } else if (event.why === "smashed") {
            this.burst(at, 26, COLORS.idiran, { speed: 3, up: 2.5, life: 0.8 });
            this.shake = Math.max(this.shake, 0.12);
          } else {
            this.burst(at, 34, COLORS.debris, { speed: 2.6, up: 3, life: 1.1, size: 1.6 });
            this.burst(at, 14, event.why === "wrecked" ? COLORS.idiran : COLORS.amber, {
              speed: 2,
              up: 2,
              life: 0.6,
            });
            this.shake = Math.max(this.shake, event.why === "wrecked" ? 0.35 : 0.2);
          }
          break;
        }
        case "woke": {
          const at = this.ground(event.at);
          this.ring(at, COLORS.glow, 4.5, 1.6);
          this.ring(at, COLORS.glow, 2.5, 1.1);
          this.burst(at.setY(at.y + 0.5), 40, COLORS.glow, {
            speed: 1.2,
            up: 4,
            life: 1.6,
            gravity: 0.5,
          });
          this.shake = Math.max(this.shake, 0.18);
          break;
        }
        case "landed": {
          const at = this.ground(event.at);
          this.ring(at, COLORS.white, 3.5, 1.4);
          this.burst(at.setY(at.y + 0.3), 40, COLORS.dust, {
            speed: 3.5,
            up: 1,
            life: 1.4,
            size: 1.8,
          });
          this.burst(at, 16, COLORS.white, { speed: 1, up: 5, life: 1, gravity: 2 });
          this.float(this.ground(event.at, 2.5), "Ship down", "info");
          this.shake = Math.max(this.shake, 0.3);
          break;
        }
        case "ordered":
          this.ring(this.ground(event.at), COLORS.glow, 0.9, 0.4);
          break;
        default:
          break;
      }
    }
  }

  /** Advance everything by `dt` seconds and lay out the floating text for `camera`. */
  update(dt: number, camera: THREE.Camera, width: number, height: number): void {
    // Particles.
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i] as Particle;
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= p.gravity * dt;
      p.velocity.multiplyScalar(1 - dt * 1.5);
      p.position.addScaledVector(p.velocity, dt);
    }
    for (const p of this.particles) {
      const fade = 1 - p.age / p.life;
      this.scale.setScalar(p.size * (0.4 + fade * 0.6));
      this.matrix.compose(p.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(n, this.matrix);
      this.mesh.setColorAt(n, p.color.clone().multiplyScalar(fade * 1.6));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    // Rings.
    for (const ring of this.rings) {
      if (ring.age >= ring.life) {
        ring.mesh.visible = false;
        continue;
      }
      ring.age += dt;
      const t = Math.min(1, ring.age / ring.life);
      ring.mesh.scale.setScalar(ring.size * (0.2 + (1 - (1 - t) ** 3) * 0.8));
      ring.material.opacity = (1 - t) * 0.9;
    }

    // Floating text, projected onto the screen.
    const projected = new THREE.Vector3();
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i] as Floater;
      f.age += dt;
      if (f.age > 1.6) {
        f.element.remove();
        this.floaters.splice(i, 1);
        continue;
      }
      projected
        .copy(f.at)
        .setY(f.at.y + f.age * 0.9)
        .project(camera);
      const visible = projected.z < 1;
      f.element.style.display = visible ? "" : "none";
      f.element.style.transform = `translate(${((projected.x + 1) / 2) * width}px, ${((1 - projected.y) / 2) * height}px) translate(-50%, -50%)`;
      f.element.style.opacity = String(Math.min(1, (1.6 - f.age) * 2));
    }

    this.shake *= Math.max(0, 1 - dt * 6);
  }
}
