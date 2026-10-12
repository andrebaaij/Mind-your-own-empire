import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { color, pass, positionWorld, sin, time, vertexColor } from "three/tsl";
import * as THREE from "three/webgpu";
import { Atmosphere, MIST, SUN_DIRECTION } from "./atmosphere";
import { CHUNK_SIZE, ZOOM_DEFAULT, ZOOM_MIN } from "./config";
import { gridFromWorld, type Point, type Rect, rectContains, worldFromGrid } from "./coords";
import { CreatureView, FIRST_SIGHTING } from "./creatures";
import { getObjectDefinition, type ObjectName } from "./definitions";
import { Fauna } from "./fauna";
import {
  createCrystalGeometry,
  createGhost,
  createModel,
  crystalMaterial,
  glowColor,
} from "./models";
import { Scenery, valueNoise } from "./scenery";
import { buildTiles, canPlace, type GameState, say } from "./state";
import { START_CENTER, Terrain } from "./terrain";
import type { Unit } from "./units";
import type { Chunk, Resource, World } from "./world";

/** Camera tilt above the horizon when zoomed out; zooming in lowers it towards the horizon. */
const PITCH = 0.82;
const PITCH_CLOSE = 0.24;

/** Camera tilt for a zoom distance: look down on the map, or across the land up close. */
function pitchFor(distance: number): number {
  const t = Math.min(1, Math.max(0, (distance - ZOOM_MIN) / (ZOOM_DEFAULT - ZOOM_MIN)));
  return PITCH_CLOSE + (PITCH - PITCH_CLOSE) * t * (2 - t);
}

/** Two shades per ground type, mixed by broad patches so the land has some texture. */
const GROUND_COLORS: Record<number, readonly [THREE.Color, THREE.Color]> = {
  [Terrain.Dirt]: [new THREE.Color("#9c4436"), new THREE.Color("#b8683f")],
  [Terrain.Sand]: [new THREE.Color("#c4925f"), new THREE.Color("#d8b07a")],
  [Terrain.Acid]: [new THREE.Color("#2c4a1e"), new THREE.Color("#3a5a22")],
};
const CLIFF_COLOR = new THREE.Color("#4e3f3e");
const SCORCH_COLOR = new THREE.Color("#2a1f1e");
/** The Mind came down hard: the ground is scorched this far around where it landed. */
const SCORCH_RADIUS = 4.5;
const ACID_GLOW = "#7dff57";
/** Brightness of explored ground no unit can currently see. */
const FOGGED = 0.35;

interface ChunkView {
  chunk: Chunk;
  version: number;
  terrain: THREE.Mesh;
  /** A glowing film over the chunk's explored acid. */
  acid: THREE.Mesh;
  crystals: THREE.InstancedMesh;
  /** Ground heights at the (CHUNK_SIZE + 1)² tile corners, and their normals. */
  cornerHeights: Float32Array;
  cornerNormals: Float32Array;
}

interface UnitView {
  model: THREE.Group;
  ring: THREE.Mesh;
  /** Pulses amber while a warden is eyeing the building. */
  alert: THREE.Mesh;
  hover: THREE.Object3D | undefined;
  spinners: THREE.Object3D[];
  heading: number;
}

/** Cheap deterministic per-tile variation, so flat colours don't look like a spreadsheet. */
function tileNoise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

/** Acid shimmers: slow bright ripples roll across it. Vertex colour red carries fog dimming. */
function acidMaterial(): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ripple = sin(positionWorld.x.mul(1.7).add(positionWorld.z.mul(1.1)).add(time.mul(1.8)))
    .mul(sin(positionWorld.z.mul(2.3).sub(time.mul(1.3))))
    .mul(0.35)
    .add(0.55);
  material.colorNode = color(ACID_GLOW).mul(ripple).mul(vertexColor().r);
  return material;
}

function angleLerp(from: number, to: number, t: number): number {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * t;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  private readonly sun = new THREE.DirectionalLight("#ffc890", 2.4);
  private readonly atmosphere = new Atmosphere();
  private readonly scenery: Scenery;
  private readonly fauna: Fauna;
  private readonly creatures: CreatureView;
  private lastFrame: number | null = null;
  private readonly pipeline: THREE.RenderPipeline;
  private readonly raycaster = new THREE.Raycaster();

  private readonly chunkViews = new Map<Chunk, ChunkView>();
  private readonly shownChunks = new Set<ChunkView>();
  private readonly unitViews = new Map<Unit, UnitView>();
  private readonly crystalGeometry = createCrystalGeometry();
  private readonly terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  });
  private readonly acidMaterial = acidMaterial();

  private readonly markers: THREE.Mesh[] = [];
  private readonly markerGeometry = new THREE.RingGeometry(0.16, 0.24, 24).rotateX(-Math.PI / 2);
  private readonly markerMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  private readonly alertMaterial = new THREE.MeshBasicMaterial({
    color: "#ffb347",
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  private readonly ghosts = new Map<ObjectName, THREE.Group[]>();
  private readonly ghostValid = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  private readonly ghostInvalid = new THREE.MeshBasicMaterial({
    color: "#ff3b3b",
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });

  private constructor(
    private readonly renderer: THREE.WebGPURenderer,
    private readonly world: World,
  ) {
    this.canvas = renderer.domElement;

    // Late afternoon: a low, warm sun, a cool sky, and haze in the distance.
    this.scene.background = MIST;
    this.scene.fog = new THREE.Fog(MIST, 40, 120);
    this.scene.add(new THREE.HemisphereLight("#a8b4e0", "#6a3a2c", 1.4));
    this.scenery = new Scenery(world);
    this.fauna = new Fauna(world);
    this.creatures = new CreatureView(world);
    this.scene.add(this.atmosphere.group, this.scenery.group, this.creatures.group);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    // Bloom makes the emissive parts (aura fields, seams, acid) glow.
    this.pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(this.scene, this.camera);
    const color = scenePass.getTextureNode("output");
    this.pipeline.outputNode = color.add(bloom(color, 0.8, 0.4, 0.95));

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  static async create(parent: HTMLElement, world: World): Promise<Renderer> {
    const renderer = new THREE.WebGPURenderer({ antialias: true });
    await renderer.init();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    parent.prepend(renderer.domElement);
    return new Renderer(renderer, world);
  }

  get width(): number {
    return this.canvas.clientWidth;
  }

  get height(): number {
    return this.canvas.clientHeight;
  }

  private resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // --- Picking ---------------------------------------------------------------------------

  private rayFrom(screen: Point): THREE.Ray {
    const ndc = new THREE.Vector2(
      (screen.x / this.width) * 2 - 1,
      -(screen.y / this.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray;
  }

  /**
   * The ground point under a screen position, found by marching the view ray over the height
   * field (works the same over explored and unexplored ground). Null when it hits only sky.
   */
  groundAt(screen: Point): Point | null {
    const ray = this.rayFrom(screen);
    const point = new THREE.Vector3();
    const step = 0.4;
    let previous = 0;
    for (let t = step; t < 300; t += step) {
      ray.at(t, point);
      if (point.y <= this.world.heightAt(point.x, point.z)) {
        // Refine between the last point above ground and this one.
        let lo = previous;
        let hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          ray.at(mid, point);
          if (point.y <= this.world.heightAt(point.x, point.z)) hi = mid;
          else lo = mid;
        }
        ray.at(hi, point);
        return { x: point.x, y: point.z };
      }
      previous = t;
    }
    return null;
  }

  private unitCenter(unit: Unit): THREE.Vector3 {
    const { position, definition } = unit;
    const ground = this.world.heightAt(position.x, position.y);
    const lift = definition.skills.walk ? (definition.altitude ?? 0) : definition.radius * 0.6;
    return new THREE.Vector3(position.x, ground + lift, position.y);
  }

  /** The unit under a screen position, nearest to the camera. */
  unitAt(screen: Point, units: readonly Unit[]): Unit | null {
    const ray = this.rayFrom(screen);
    let best: Unit | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const hit = new THREE.Vector3();
    for (const unit of units) {
      const sphere = new THREE.Sphere(this.unitCenter(unit), unit.definition.radius * 1.3);
      if (ray.intersectSphere(sphere, hit)) {
        const d = hit.distanceTo(ray.origin);
        if (d < bestDistance) {
          best = unit;
          bestDistance = d;
        }
      }
    }
    return best;
  }

  private toScreen(point: THREE.Vector3): Point | null {
    const projected = point.clone().project(this.camera);
    if (projected.z > 1) return null; // behind the camera
    return {
      x: ((projected.x + 1) / 2) * this.width,
      y: ((1 - projected.y) / 2) * this.height,
    };
  }

  /** Units drawn inside a screen rectangle. */
  unitsInScreenRect(rect: Rect, units: readonly Unit[]): Unit[] {
    return units.filter((unit) => {
      const screen = this.toScreen(this.unitCenter(unit));
      return screen !== null && rectContains(rect, screen);
    });
  }

  /** Explored iron drawn inside a screen rectangle. */
  resourcesInScreenRect(rect: Rect): Resource[] {
    const found: Resource[] = [];
    for (const view of this.shownChunks) {
      for (const resource of view.chunk.resources) {
        if (!resource?.exists || !this.world.isExplored(resource.grid)) continue;
        const { x, y } = resource.position;
        const screen = this.toScreen(new THREE.Vector3(x, this.world.heightAt(x, y), y));
        if (screen && rectContains(rect, screen)) found.push(resource);
      }
    }
    return found;
  }

  // --- Frame -----------------------------------------------------------------------------

  render(state: GameState, time: number): void {
    this.placeCamera(state);
    this.renderChunks(state);
    this.renderUnits(state, time);
    this.renderFauna(state, time);
    this.renderMarkers(state);
    this.renderGhosts(state);
    this.pipeline.render();
  }

  private placeCamera(state: GameState): void {
    const { target, yaw, distance } = state.camera;
    const ground = this.world.heightAt(target.x, target.y);
    const pitch = pitchFor(distance);
    const horizontal = Math.cos(pitch) * distance;
    // Up close, aim a little above the ground so the horizon comes into view.
    const lift = (1 - (pitch - PITCH_CLOSE) / (PITCH - PITCH_CLOSE)) * 1.2;
    this.camera.position.set(
      target.x + Math.sin(yaw) * horizontal,
      ground + lift + Math.sin(pitch) * distance,
      target.y + Math.cos(yaw) * horizontal,
    );
    this.camera.lookAt(target.x, ground + lift, target.y);
    const focus = new THREE.Vector3(target.x, ground, target.y);
    this.atmosphere.update(this.camera.position, focus);

    // Keep the shadow-casting light and its shadow box centred on what we're looking at. The
    // light comes from the sun's side but higher, so shadows are long without being endless.
    const reach = distance * 1.6 + 6;
    this.sun.position
      .set(SUN_DIRECTION.x, 0.55, SUN_DIRECTION.z)
      .normalize()
      .multiplyScalar(60)
      .add(focus);
    this.sun.target.position.copy(focus);
    const shadow = this.sun.shadow.camera;
    shadow.left = -reach;
    shadow.right = reach;
    shadow.top = reach;
    shadow.bottom = -reach;
    shadow.far = 140;
    shadow.updateProjectionMatrix();

    const fog = this.scene.fog as THREE.Fog;
    fog.near = distance * 1.6;
    fog.far = distance * 4.5;
  }

  private renderChunks(state: GameState): void {
    const { target, distance } = state.camera;
    const reach = distance * 2.5 + CHUNK_SIZE;
    const min = gridFromWorld({ x: target.x - reach, y: target.y - reach });
    const max = gridFromWorld({ x: target.x + reach, y: target.y + reach });

    // Scenery is dense, so only the chunks near the view get it.
    const decorReach = distance * 1.4 + 12;
    const decor: Chunk[] = [];
    const shown = new Set<ChunkView>();
    for (let cy = min.chunkY; cy <= max.chunkY; cy++) {
      for (let cx = min.chunkX; cx <= max.chunkX; cx++) {
        const chunk = state.world.getChunk(cx, cy);
        const view = this.chunkView(chunk);
        if (view.version !== chunk.version) this.syncChunk(view);
        shown.add(view);
        const middle = (CHUNK_SIZE / 2) | 0;
        const near =
          Math.abs(chunk.x * CHUNK_SIZE + middle - target.x) < decorReach &&
          Math.abs(chunk.y * CHUNK_SIZE + middle - target.y) < decorReach;
        if (near) decor.push(chunk);
      }
    }
    this.scenery.update(decor);
    for (const view of this.shownChunks) {
      if (!shown.has(view)) {
        view.terrain.visible = false;
        view.acid.visible = false;
        view.crystals.visible = false;
      }
    }
    this.shownChunks.clear();
    for (const view of shown) {
      view.terrain.visible = true;
      view.acid.visible = true;
      view.crystals.visible = true;
      this.shownChunks.add(view);
    }
  }

  private chunkView(chunk: Chunk): ChunkView {
    const existing = this.chunkViews.get(chunk);
    if (existing) return existing;

    // Corner heights and normals never change, so compute them once per chunk.
    const side = CHUNK_SIZE + 1;
    const cornerHeights = new Float32Array(side * side);
    const cornerNormals = new Float32Array(side * side * 3);
    const e = 0.25;
    for (let j = 0; j < side; j++) {
      for (let i = 0; i < side; i++) {
        const x = chunk.x * CHUNK_SIZE + i;
        const y = chunk.y * CHUNK_SIZE + j;
        const k = i + j * side;
        cornerHeights[k] = this.world.heightAt(x, y);
        const normal = new THREE.Vector3(
          (this.world.heightAt(x - e, y) - this.world.heightAt(x + e, y)) / (2 * e),
          1,
          (this.world.heightAt(x, y - e) - this.world.heightAt(x, y + e)) / (2 * e),
        ).normalize();
        cornerNormals.set([normal.x, normal.y, normal.z], k * 3);
      }
    }

    const terrain = new THREE.Mesh(new THREE.BufferGeometry(), this.terrainMaterial);
    terrain.receiveShadow = true;
    const acid = new THREE.Mesh(new THREE.BufferGeometry(), this.acidMaterial);
    const crystals = new THREE.InstancedMesh(
      this.crystalGeometry,
      crystalMaterial,
      CHUNK_SIZE * CHUNK_SIZE,
    );
    crystals.castShadow = true;
    crystals.count = 0;
    this.scene.add(terrain, acid, crystals);

    const view: ChunkView = {
      chunk,
      version: -1,
      terrain,
      acid,
      crystals,
      cornerHeights,
      cornerNormals,
    };
    this.chunkViews.set(chunk, view);
    return view;
  }

  /** Rebuild a chunk's ground mesh and crystals from its current fog and resources. */
  private syncChunk(view: ChunkView): void {
    const { chunk, cornerHeights, cornerNormals } = view;
    const side = CHUNK_SIZE + 1;
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const acid = { positions: [] as number[], colors: [] as number[], indices: [] as number[] };
    const color = new THREE.Color();

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const i = lx + ly * CHUNK_SIZE;
        if (chunk.explored[i] !== 1) continue; // the unexplored stays black

        const x = chunk.x * CHUNK_SIZE + lx;
        const y = chunk.y * CHUNK_SIZE + ly;
        const ground = chunk.tiles[i] ?? Terrain.Dirt;
        const palette = GROUND_COLORS[ground] ?? GROUND_COLORS[Terrain.Dirt];
        const cliff = chunk.cliffs[i] === 1 && ground !== Terrain.Acid;
        const seen = (chunk.watchers[i] ?? 0) > 0;
        const isAcid = ground === Terrain.Acid;
        const base = positions.length / 3;
        for (const [dx, dy] of CORNERS) {
          const k = lx + dx + (ly + dy) * side;
          const cx = x + dx;
          const cy = y + dy;
          const height = cornerHeights[k] ?? 0;
          positions.push(cx, height, cy);
          const ny = cornerNormals[k * 3 + 1] ?? 1;
          normals.push(cornerNormals[k * 3] ?? 0, ny, cornerNormals[k * 3 + 2] ?? 0);

          // Colour varies smoothly over the land, so neighbouring tiles blend into each other.
          if (palette) {
            const patch = valueNoise(cx / 7, cy / 7, 3) * 0.7 + valueNoise(cx / 2, cy / 2, 5) * 0.3;
            color.copy(palette[0]).lerp(palette[1], patch);
          }
          // Bare rock shows on steep slopes and cliffs; high ground is sun-bleached.
          const steep = Math.min(1, Math.max(0, (0.93 - ny) * 5));
          color.lerp(CLIFF_COLOR, Math.max(steep, cliff ? 0.55 : 0));
          color.multiplyScalar(0.92 + height * 0.04 + tileNoise(cx, cy) * 0.08);
          const scorch = Math.hypot(cx - START_CENTER.x, cy - START_CENTER.y) / SCORCH_RADIUS;
          if (scorch < 1) color.lerp(SCORCH_COLOR, (1 - scorch) * 0.7);
          if (!seen) color.multiplyScalar(FOGGED);
          colors.push(color.r, color.g, color.b);

          if (isAcid) {
            acid.positions.push(cx, height + 0.04, cy);
            acid.colors.push(seen ? 1 : FOGGED, 0, 0);
          }
        }
        indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
        if (isAcid) {
          const a = acid.positions.length / 3 - 4;
          acid.indices.push(a, a + 2, a + 1, a, a + 3, a + 2);
        }
      }
    }

    const film = new THREE.BufferGeometry();
    film.setAttribute("position", new THREE.Float32BufferAttribute(acid.positions, 3));
    film.setAttribute("color", new THREE.Float32BufferAttribute(acid.colors, 3));
    film.setIndex(acid.indices);
    view.acid.geometry.dispose();
    view.acid.geometry = film;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    view.terrain.geometry.dispose();
    view.terrain.geometry = geometry;

    // Iron crystals on explored tiles, bigger the more ore is left.
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    let count = 0;
    chunk.resources.forEach((resource, i) => {
      if (!resource?.exists || resource.level < 0 || chunk.explored[i] !== 1) return;
      const { x, y } = resource.position;
      const jitter = tileNoise(x, y);
      position.set(x, this.world.heightAt(x, y), y);
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), jitter * Math.PI * 2);
      const size = 0.6 + resource.level * 0.18;
      scale.set(size, size * (0.8 + jitter * 0.5), size);
      matrix.compose(position, rotation, scale);
      view.crystals.setMatrixAt(count++, matrix);
    });
    view.crystals.count = count;
    view.crystals.instanceMatrix.needsUpdate = true;
    view.crystals.computeBoundingSphere();

    view.version = chunk.version;
  }

  private unitView(unit: Unit): UnitView {
    let view = this.unitViews.get(unit);
    if (view) return view;

    const model = createModel(unit.name, unit.color);
    const radius = unit.definition.radius;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.15, radius * 1.35, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: glowColor(unit.color),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    ring.visible = false;
    const alert = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.5, radius * 1.75, 40).rotateX(-Math.PI / 2),
      this.alertMaterial,
    );
    alert.visible = false;
    const spinners: THREE.Object3D[] = [];
    model.traverse((child) => {
      if (child.name === "spin") spinners.push(child);
    });
    this.scene.add(model, ring, alert);
    view = {
      model,
      ring,
      alert,
      hover: model.getObjectByName("hover"),
      spinners,
      heading: unit.heading,
    };
    this.unitViews.set(unit, view);
    return view;
  }

  /** Height a building sits at: the top of its footprint, with its plinth covering the slope. */
  private baseHeight(unit: Unit): number {
    if (unit.footprint.length === 0) return this.world.heightAt(unit.position.x, unit.position.y);
    return Math.max(...unit.footprint.map((tile) => this.world.tileHeight(tile)));
  }

  private renderUnits(state: GameState, time: number): void {
    // Units that left the game (dismantled buildings) take their models with them.
    for (const [unit, view] of this.unitViews) {
      if (!state.units.includes(unit)) {
        this.scene.remove(view.model, view.ring, view.alert);
        this.unitViews.delete(unit);
      }
    }

    for (const unit of state.units) {
      const view = this.unitView(unit);
      const { position, definition } = unit;
      const ground = this.baseHeight(unit);
      const mobile = definition.skills.walk === true;

      // Other factions are only seen where the player has eyes.
      const seen = unit.faction === "player" || this.world.isVisible(unit.grid);
      view.model.visible = seen;
      if (!seen) {
        view.ring.visible = false;
        continue;
      }

      // Drones hover with a gentle bob; each one is out of phase with the others.
      const bob = mobile ? Math.sin(time * 2.2 + unit.id * 1.7) * 0.05 : 0;
      view.model.position.set(position.x, ground + (definition.altitude ?? 0) + bob, position.y);

      // A building being dismantled shudders and sinks.
      const dismantling = unit.dismantling ?? 0;
      view.model.scale.setScalar(1);
      if (dismantling > 0) {
        view.model.scale.y = 1 - dismantling * 0.7;
        view.model.position.x += Math.sin(time * 40) * 0.03 * dismantling;
      }

      view.heading = angleLerp(view.heading, unit.heading, 0.2);
      view.model.rotation.y = -view.heading;
      // Lean into the turn and forward when moving, like a drone tilting its field.
      view.model.rotation.z = mobile && unit.moving ? -0.12 : 0;

      if (view.hover) view.hover.position.y = 1.2 + Math.sin(time * 0.8) * 0.06;
      for (const spinner of view.spinners) spinner.rotation.z = time * 0.4;

      view.alert.visible = unit.inspected === true;
      if (view.alert.visible) {
        view.alert.position.set(
          position.x,
          this.world.heightAt(position.x, position.y) + 0.05,
          position.y,
        );
        view.alert.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
      }

      view.ring.visible = unit.selected;
      view.ring.position.set(
        position.x,
        this.world.heightAt(position.x, position.y) + 0.04,
        position.y,
      );
    }
  }

  /** Wildlife lives on its own clock: it stops when the game is paused. */
  private renderFauna(state: GameState, time: number): void {
    const dt = this.lastFrame === null || state.paused ? 0 : Math.min(0.1, time - this.lastFrame);
    this.lastFrame = time;
    this.fauna.update(state.units, state.camera.target, dt);
    for (const kind of this.creatures.update(this.fauna, time)) {
      say(state, FIRST_SIGHTING[kind], "info", { once: `sighted-${kind}` });
    }
  }

  private renderMarkers(state: GameState): void {
    this.markerMaterial.color.copy(glowColor(state.player.color));
    let used = 0;
    for (const unit of state.selection) {
      for (const action of unit.actions) {
        let marker = this.markers[used];
        if (!marker) {
          marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
          this.markers.push(marker);
          this.scene.add(marker);
        }
        const { x, y } = action.target;
        marker.position.set(x, this.world.heightAt(x, y) + 0.05, y);
        marker.visible = true;
        used++;
      }
    }
    for (let i = used; i < this.markers.length; i++) {
      const marker = this.markers[i];
      if (marker) marker.visible = false;
    }
  }

  private renderGhosts(state: GameState): void {
    const used = new Map<ObjectName, number>();
    if (state.building) {
      const name = state.building;
      this.ghostValid.color.copy(glowColor(state.player.color));
      const definition = getObjectDefinition(name);
      for (const tile of buildTiles(state.pointer)) {
        const index = used.get(name) ?? 0;
        used.set(name, index + 1);
        let pool = this.ghosts.get(name);
        if (!pool) {
          pool = [];
          this.ghosts.set(name, pool);
        }
        let ghost = pool[index];
        if (!ghost) {
          ghost = createGhost(name, this.ghostValid);
          pool.push(ghost);
          this.scene.add(ghost);
        }

        // Red where it can't go, like AoE's placement preview.
        const material = canPlace(state, name, tile) ? this.ghostValid : this.ghostInvalid;
        ghost.traverse((child) => {
          if (child instanceof THREE.Mesh && child.name !== "aura") child.material = material;
        });
        const center = worldFromGrid(tile.x, tile.y);
        ghost.position.set(
          center.x,
          this.world.tileHeight(tile) + (definition.altitude ?? 0),
          center.y,
        );
        ghost.visible = true;
      }
    }
    for (const [name, pool] of this.ghosts) {
      const count = used.get(name) ?? 0;
      pool.forEach((ghost, i) => {
        ghost.visible = i < count;
      });
    }
  }
}
