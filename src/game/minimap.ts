/**
 * The minimap: the land around the camera as the player knows it (explored ground, fog, bloom
 * and lattice, sites), with everyone the player can see on it and the camera's view outlined.
 * It turns with the camera, so "up" on the minimap is always "up" on the screen. Left-click to
 * look somewhere; right-click to send the selection there.
 */

import { gridRef, type Point } from "./coords";
import type { GameState } from "./state";
import { Terrain } from "./terrain";
import { windDirection, windStrength } from "./windField";

/** Tiles from the centre to the edge of the minimap. */
const REACH = 48;
const SIZE = 188;
/** How often the land itself is redrawn (units move every frame). */
const TERRAIN_INTERVAL = 0.4;

const RGB = {
  dirt: [150, 70, 52],
  dunes: [196, 146, 86],
  ash: [102, 82, 94],
  salt: [214, 200, 194],
  lush: [72, 108, 72],
  water: [44, 112, 128],
  sand: [196, 150, 98],
  acid: [92, 210, 70],
  cliff: [78, 62, 60],
  paved: [168, 158, 136],
  ruin: [110, 100, 85],
  bloom: [255, 171, 94],
  lattice: [127, 240, 204],
  unknown: [22, 18, 22],
} as const;

export interface MinimapActions {
  look(at: Point): void;
  order(at: Point): void;
}

export class Minimap {
  readonly element: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly terrain: HTMLCanvasElement;
  private readonly terrainContext: CanvasRenderingContext2D;
  private terrainAge = Number.POSITIVE_INFINITY;
  private center: Point = { x: 0, y: 0 };
  private yaw = 0;
  private dragging = false;

  constructor(parent: HTMLElement, actions: MinimapActions) {
    this.element = document.createElement("canvas");
    this.element.className = "minimap glass";
    this.element.width = SIZE;
    this.element.height = SIZE;
    this.element.setAttribute("aria-label", "Minimap");
    parent.append(this.element);
    const context = this.element.getContext("2d");
    if (!context) throw new Error("no 2d context for the minimap");
    this.context = context;

    this.terrain = document.createElement("canvas");
    this.terrain.width = REACH * 2;
    this.terrain.height = REACH * 2;
    const terrainContext = this.terrain.getContext("2d");
    if (!terrainContext) throw new Error("no 2d context for the minimap");
    this.terrainContext = terrainContext;

    this.element.addEventListener("contextmenu", (event) => event.preventDefault());
    this.element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const at = this.toWorld(event);
      if (event.button === 2) actions.order(at);
      else {
        this.dragging = true;
        this.element.setPointerCapture(event.pointerId);
        actions.look(at);
      }
    });
    this.element.addEventListener("pointermove", (event) => {
      if (this.dragging) actions.look(this.toWorld(event));
    });
    this.element.addEventListener("pointerup", () => {
      this.dragging = false;
    });
  }

  /** The ground point under a pointer event on the minimap. */
  private toWorld(event: PointerEvent): Point {
    const rect = this.element.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width - 0.5) * REACH * 2;
    const py = ((event.clientY - rect.top) / rect.height - 0.5) * REACH * 2;
    // Undo the minimap's rotation.
    const cos = Math.cos(-this.yaw);
    const sin = Math.sin(-this.yaw);
    return {
      x: this.center.x + px * cos - py * sin,
      y: this.center.y + px * sin + py * cos,
    };
  }

  /** Repaint the land as the player knows it, around `center`. */
  private paintTerrain(state: GameState): void {
    const side = REACH * 2;
    const image = this.terrainContext.createImageData(side, side);
    const x0 = Math.floor(this.center.x) - REACH;
    const y0 = Math.floor(this.center.y) - REACH;
    const { world } = state;
    for (let j = 0; j < side; j++) {
      for (let i = 0; i < side; i++) {
        const grid = gridRef(x0 + i, y0 + j);
        const chunk = world.getChunk(grid.chunkX, grid.chunkY);
        const k = grid.i;
        let rgb: readonly number[] = RGB.unknown;
        let shade = 1;
        if (chunk.explored[k] === 1) {
          const resource = chunk.resources[k];
          if (resource?.exists && (chunk.occupied[k] ?? 0) === 0) {
            rgb = resource.kind === "iron" ? RGB.bloom : RGB.lattice;
          } else if (chunk.ruin[k] === 1) rgb = RGB.ruin;
          else if (chunk.paved[k] === 1) rgb = RGB.paved;
          else if (chunk.tiles[k] === Terrain.Acid) rgb = RGB.acid;
          else if (chunk.tiles[k] === Terrain.Water) rgb = RGB.water;
          else if (chunk.cliffs[k] === 1) rgb = RGB.cliff;
          else if (chunk.tiles[k] === Terrain.Sand) rgb = RGB.sand;
          else {
            const region = world.regionOf(grid);
            rgb = region === "rust" ? RGB.dirt : RGB[region];
          }
          // A little relief from the height, and the fog where nobody's watching.
          shade = 0.85 + (chunk.heights[k] ?? 0) * 0.06;
          if ((chunk.watchers[k] ?? 0) === 0) shade *= 0.5;
        }
        const p = (i + j * side) * 4;
        image.data[p] = (rgb[0] ?? 0) * shade;
        image.data[p + 1] = (rgb[1] ?? 0) * shade;
        image.data[p + 2] = (rgb[2] ?? 0) * shade;
        image.data[p + 3] = 255;
      }
    }
    this.terrainContext.putImageData(image, 0, 0);
  }

  /** Draw the minimap for this frame. `view` is the camera's footprint on the ground. */
  update(state: GameState, dt: number, view: readonly Point[]): void {
    const { target, yaw } = state.camera;
    this.terrainAge += dt;
    const moved = Math.hypot(target.x - this.center.x, target.y - this.center.y);
    if (this.terrainAge >= TERRAIN_INTERVAL || moved > 6) {
      this.center = { x: Math.floor(target.x), y: Math.floor(target.y) };
      this.paintTerrain(state);
      this.terrainAge = 0;
    }
    // Screen "up" is the camera's forward direction: turning by the yaw lines them up.
    this.yaw = yaw;

    const ctx = this.context;
    const scale = SIZE / (REACH * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(this.yaw);
    ctx.scale(scale, scale);
    // Everything below is in tiles, relative to the minimap's centre.
    const local = (p: Point): [number, number] => [p.x - this.center.x, p.y - this.center.y];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, -REACH, -REACH);

    // Tessilend sites the player has found.
    for (const site of state.world.sitesNear(this.center, REACH * 1.5)) {
      if (!site.seen) continue;
      const [x, y] = local(site.center);
      ctx.fillStyle = site.status === "awake" ? "#7ff0cc" : "#c9bda6";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 2.2);
      ctx.lineTo(x + 2.2, y);
      ctx.lineTo(x, y + 2.2);
      ctx.lineTo(x - 2.2, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Units: ours always, others only where we can see them.
    for (const unit of state.units) {
      const visible = unit.faction === "player" || state.world.isVisible(unit.grid);
      if (!visible) continue;
      const [x, y] = local(unit.position);
      const building = unit.footprint.length > 0;
      ctx.fillStyle =
        unit.faction === "player"
          ? unit.selected
            ? "#ffffff"
            : "#5fe0ff"
          : unit.faction === "custody"
            ? "#ffb347"
            : "#ff4a2a";
      if (building) {
        const size = Math.max(1.6, (unit.definition.footprint ?? 1) * 0.9);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, unit.faction === "idiran" ? 1.3 : 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Which way the wind blows: an arrow at the rim, pointing downwind, longer in a gust.
    const wind = windDirection.value;
    const reach = REACH - 5;
    const length = 3 + windStrength.value * 4;
    ctx.save();
    ctx.translate(wind.x * reach, wind.y * reach);
    ctx.rotate(Math.atan2(wind.y, wind.x));
    ctx.strokeStyle = "rgba(255, 236, 210, 0.85)";
    ctx.lineWidth = 0.9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-length, 0);
    ctx.lineTo(0, 0);
    ctx.moveTo(-1.8, -1.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-1.8, 1.5);
    ctx.stroke();
    ctx.restore();

    // Where the camera is looking.
    if (view.length >= 3) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      view.forEach((corner, i) => {
        const [x, y] = local(corner);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
}
