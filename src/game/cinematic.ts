/**
 * Mission intros: the camera flies between a few places that matter, letterboxed, with a title
 * card and a caption or two, before handing over to the player. Esc, Space or a click skips.
 */

import { gridFromWorld, type Point } from "./coords";
import type { Camera, GameState } from "./state";

export interface Shot {
  /** Where the camera looks, from how far, and from which side. */
  target: Point;
  distance: number;
  yaw: number;
  /** Seconds the camera takes to get here and linger. */
  seconds: number;
  caption?: string;
  /** Chart the ground around the target, so there's something to see (and find later). */
  reveal?: number;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function angleLerp(from: number, to: number, t: number): number {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
}

export class Cinematic {
  private shot = -1;
  private elapsed = 0;
  private from: Camera;
  private readonly home: Camera;
  private readonly root: HTMLElement;
  private readonly caption: HTMLElement;
  private done = false;
  private total = 0;
  private readonly skip = (event: Event) => {
    if (event instanceof KeyboardEvent && !["Escape", "Space", "Enter"].includes(event.code))
      return;
    event.preventDefault();
    this.finish();
  };

  constructor(
    private readonly state: GameState,
    private readonly shots: readonly Shot[],
    title: { kicker: string; title: string },
    private readonly onDone: () => void,
    private readonly speak: (text: string) => void = () => {},
  ) {
    this.home = { ...state.camera, target: { ...state.camera.target } };
    this.from = this.home;
    const game = document.getElementById("game");
    if (!game) throw new Error("Missing #game");
    this.root = document.createElement("div");
    this.root.className = "cinematic";
    this.root.innerHTML = `
      <div class="letterbox top"></div>
      <div class="letterbox bottom"></div>
      <div class="cinematic-title">
        <div class="label"></div>
        <h1></h1>
      </div>
      <p class="cinematic-caption"></p>
      <p class="cinematic-skip label">Esc to skip</p>`;
    (this.root.querySelector(".cinematic-title .label") as HTMLElement).textContent = title.kicker;
    (this.root.querySelector(".cinematic-title h1") as HTMLElement).textContent = title.title;
    this.caption = this.root.querySelector(".cinematic-caption") as HTMLElement;
    game.append(this.root);
    game.classList.add("in-cinematic");
    window.addEventListener("keydown", this.skip, true);
    this.root.addEventListener("pointerdown", this.skip);
    // The world holds still while the camera tours it.
    state.paused = true;
    // The places on the tour are in plain view while it lasts, and charted afterwards.
    for (const shot of shots) {
      if (shot.reveal) state.world.watch(gridFromWorld(shot.target), shot.reveal);
    }
    this.next();
  }

  private next(): void {
    this.shot++;
    this.elapsed = 0;
    this.from = { ...this.state.camera, target: { ...this.state.camera.target } };
    const shot = this.shots[this.shot];
    if (!shot) {
      this.finish();
      return;
    }
    this.caption.classList.remove("shown");
    if (shot.caption) {
      this.speak(shot.caption);
      this.caption.textContent = shot.caption;
      void this.caption.offsetWidth;
      this.caption.classList.add("shown");
    }
  }

  /** Move the camera along; call once a frame with the seconds since the last. */
  update(dt: number): void {
    if (this.done) return;
    const shot = this.shots[this.shot];
    if (!shot) return;
    this.elapsed += dt;
    this.total += dt;
    // The title card fades after a moment.
    if (this.total > 2.5) this.root.classList.add("titled");
    // Travel for the first 60% of the shot, then hold.
    const t = ease(Math.min(1, this.elapsed / (shot.seconds * 0.6)));
    const camera = this.state.camera;
    camera.target = {
      x: this.from.target.x + (shot.target.x - this.from.target.x) * t,
      y: this.from.target.y + (shot.target.y - this.from.target.y) * t,
    };
    camera.distance = this.from.distance + (shot.distance - this.from.distance) * t;
    camera.yaw = angleLerp(this.from.yaw, shot.yaw, t);
    if (this.elapsed >= shot.seconds) this.next();
  }

  get running(): boolean {
    return !this.done;
  }

  /** End the intro (or skip it): back to the Mind, and over to the player. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    window.removeEventListener("keydown", this.skip, true);
    for (const shot of this.shots) {
      if (shot.reveal) this.state.world.unwatch(gridFromWorld(shot.target), shot.reveal);
    }
    this.root.classList.add("leaving");
    document.getElementById("game")?.classList.remove("in-cinematic");
    setTimeout(() => this.root.remove(), 600);
    this.state.camera = { ...this.home, target: { ...this.home.target } };
    this.state.paused = false;
    this.onDone();
  }
}
