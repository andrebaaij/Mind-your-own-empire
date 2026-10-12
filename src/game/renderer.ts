import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { pass } from "three/tsl";
import * as THREE from "three/webgpu";
import { CHUNK_SIZE } from "./config";
import { gridFromWorld, type Point, type Rect, rectContains, worldFromGrid } from "./coords";
import { getObjectDefinition, type ObjectName } from "./definitions";
import {
  createCrystalGeometry,
  createGhost,
  createModel,
  crystalMaterial,
  glowColor,
} from "./models";
import { buildTiles, canPlace, type GameState } from "./state";
import { Terrain } from "./terrain";
import type { Unit } from "./units";
import type { Chunk, Resource, World } from "./world";

/** Camera tilt above the horizon. */
const PITCH = 0.82;
const SKY = new THREE.Color("#05060b");

const GROUND_COLORS: Record<number, THREE.Color> = {
  [Terrain.Dirt]: new THREE.Color("#b5524a"),
  [Terrain.Sand]: new THREE.Color("#c99a68"),
  [Terrain.Acid]: new THREE.Color("#7dff57"),
};
const CLIFF_COLOR = new THREE.Color("#5b4b49");
/** Brightness of explored ground no unit can currently see. */
const FOGGED = 0.35;

interface ChunkView {
  chunk: Chunk;
  version: number;
  terrain: THREE.Mesh;
  crystals: THREE.InstancedMesh;
  /** Ground heights at the (CHUNK_SIZE + 1)² tile corners, and their normals. */
  cornerHeights: Float32Array;
  cornerNormals: Float32Array;
}

interface UnitView {
  model: THREE.Group;
  ring: THREE.Mesh;
  hover: THREE.Object3D | undefined;
  spinners: THREE.Object3D[];
  heading: number;
}

/** Cheap deterministic per-tile variation, so flat colours don't look like a spreadsheet. */
function tileNoise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function angleLerp(from: number, to: number, t: number): number {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * t;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  private readonly sun = new THREE.DirectionalLight("#fff0dc", 1.7);
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

  private readonly markers: THREE.Mesh[] = [];
  private readonly markerGeometry = new THREE.RingGeometry(0.16, 0.24, 24).rotateX(-Math.PI / 2);
  private readonly markerMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.85,
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

    this.scene.background = SKY;
    this.scene.fog = new THREE.Fog(SKY, 40, 120);
    this.scene.add(new THREE.HemisphereLight("#c4d4ff", "#3a2420", 0.75));

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
    this.renderMarkers(state);
    this.renderGhosts(state);
    this.pipeline.render();
  }

  private placeCamera(state: GameState): void {
    const { target, yaw, distance } = state.camera;
    const ground = this.world.heightAt(target.x, target.y);
    const horizontal = Math.cos(PITCH) * distance;
    this.camera.position.set(
      target.x + Math.sin(yaw) * horizontal,
      ground + Math.sin(PITCH) * distance,
      target.y + Math.cos(yaw) * horizontal,
    );
    this.camera.lookAt(target.x, ground, target.y);

    // Keep the shadow-casting light and its shadow box centred on what we're looking at.
    const reach = distance * 1.4;
    this.sun.position.set(target.x - 20, ground + 40, target.y - 12);
    this.sun.target.position.set(target.x, ground, target.y);
    const shadow = this.sun.shadow.camera;
    shadow.left = -reach;
    shadow.right = reach;
    shadow.top = reach;
    shadow.bottom = -reach;
    shadow.far = 120;
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

    const shown = new Set<ChunkView>();
    for (let cy = min.chunkY; cy <= max.chunkY; cy++) {
      for (let cx = min.chunkX; cx <= max.chunkX; cx++) {
        const chunk = state.world.getChunk(cx, cy);
        const view = this.chunkView(chunk);
        if (view.version !== chunk.version) this.syncChunk(view);
        shown.add(view);
      }
    }
    for (const view of this.shownChunks) {
      if (!shown.has(view)) {
        view.terrain.visible = false;
        view.crystals.visible = false;
      }
    }
    this.shownChunks.clear();
    for (const view of shown) {
      view.terrain.visible = true;
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
    const crystals = new THREE.InstancedMesh(
      this.crystalGeometry,
      crystalMaterial,
      CHUNK_SIZE * CHUNK_SIZE,
    );
    crystals.castShadow = true;
    crystals.count = 0;
    this.scene.add(terrain, crystals);

    const view: ChunkView = {
      chunk,
      version: -1,
      terrain,
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
    const color = new THREE.Color();

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const i = lx + ly * CHUNK_SIZE;
        if (chunk.explored[i] !== 1) continue; // the unexplored stays black

        const x = chunk.x * CHUNK_SIZE + lx;
        const y = chunk.y * CHUNK_SIZE + ly;
        color.copy(
          GROUND_COLORS[chunk.tiles[i] ?? 0] ?? (GROUND_COLORS[Terrain.Dirt] as THREE.Color),
        );
        if (chunk.cliffs[i] === 1 && chunk.tiles[i] !== Terrain.Acid) color.lerp(CLIFF_COLOR, 0.6);
        color.multiplyScalar(0.9 + tileNoise(x, y) * 0.2);
        if ((chunk.watchers[i] ?? 0) === 0) color.multiplyScalar(FOGGED);

        const base = positions.length / 3;
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ] as const) {
          const k = lx + dx + (ly + dy) * side;
          positions.push(x + dx, cornerHeights[k] ?? 0, y + dy);
          normals.push(
            cornerNormals[k * 3] ?? 0,
            cornerNormals[k * 3 + 1] ?? 1,
            cornerNormals[k * 3 + 2] ?? 0,
          );
          colors.push(color.r, color.g, color.b);
        }
        indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
    }

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
    const spinners: THREE.Object3D[] = [];
    model.traverse((child) => {
      if (child.name === "spin") spinners.push(child);
    });
    this.scene.add(model, ring);
    view = { model, ring, hover: model.getObjectByName("hover"), spinners, heading: unit.heading };
    this.unitViews.set(unit, view);
    return view;
  }

  /** Height a building sits at: the top of its footprint, with its plinth covering the slope. */
  private baseHeight(unit: Unit): number {
    if (unit.footprint.length === 0) return this.world.heightAt(unit.position.x, unit.position.y);
    return Math.max(...unit.footprint.map((tile) => this.world.tileHeight(tile)));
  }

  private renderUnits(state: GameState, time: number): void {
    for (const unit of state.units) {
      const view = this.unitView(unit);
      const { position, definition } = unit;
      const ground = this.baseHeight(unit);
      const mobile = definition.skills.walk === true;

      // Drones hover with a gentle bob; each one is out of phase with the others.
      const bob = mobile ? Math.sin(time * 2.2 + unit.id * 1.7) * 0.05 : 0;
      view.model.position.set(position.x, ground + (definition.altitude ?? 0) + bob, position.y);

      view.heading = angleLerp(view.heading, unit.heading, 0.2);
      view.model.rotation.y = -view.heading;
      // Lean into the turn and forward when moving, like a drone tilting its field.
      view.model.rotation.z = mobile && unit.moving ? -0.12 : 0;

      if (view.hover) view.hover.position.y = 1.2 + Math.sin(time * 0.8) * 0.06;
      for (const spinner of view.spinners) spinner.rotation.z = time * 0.4;

      view.ring.visible = unit.selected;
      view.ring.position.set(
        position.x,
        this.world.heightAt(position.x, position.y) + 0.04,
        position.y,
      );
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
