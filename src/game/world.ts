import { CHUNK_SIZE, MAX_CLIMB } from "./config";
import { type GridRef, gridRef, type Point, worldFromGrid } from "./coords";
import { getResourceDefinition } from "./definitions";
import {
  createSite,
  REGION,
  regionOf,
  regionSiteSpec,
  type Seam,
  type Site,
  type SiteGround,
  type SiteSpec,
} from "./sites";
import { Terrain, type TerrainGenerator } from "./terrain";

export type ResourceKind = "iron" | "lattice";

/** Furthest a site's paving or seams reach from its centre tile. */
const SITE_REACH = 9;
/** Generated sites keep this far from sites a mission placed by hand. */
const EXPLICIT_CLEARANCE = 16;

export interface Resource {
  kind: ResourceKind;
  amount: number;
  /** Visual level, or -1 once depleted. */
  level: number;
  grid: GridRef;
  position: Point;
  exists: boolean;
}

export class Chunk {
  /** Ground type of each tile (see `Terrain`). */
  readonly tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  /** Ground height at each tile's centre. */
  readonly heights = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  /** Whether a tile has a cliff edge: a neighbour too steep to climb to. */
  readonly cliffs = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  readonly resources: (Resource | undefined)[] = new Array(CHUNK_SIZE * CHUNK_SIZE);
  /** Whether a tile has ever been seen. Unexplored tiles are not drawn. */
  readonly explored = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  /** Number of objects currently in communication range of each tile. */
  readonly watchers = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE);
  /** Number of buildings standing on each tile. Occupied tiles can't be walked through. */
  readonly occupied = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  /** Tiles a Tessilend structure stands on (also counted in `occupied`). */
  readonly ruin = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  /** Tessilend foundations: paved ground the Custody considers built to plan. */
  readonly paved = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  /** Bumped on every visible change so the renderer knows to resync this chunk. */
  version = 0;

  constructor(
    readonly x: number,
    readonly y: number,
  ) {}
}

/** Highest level whose threshold the amount exceeds, or -1 if none. */
export function resourceLevel(amount: number, levels: readonly number[]): number {
  let level = -1;
  levels.forEach((threshold, index) => {
    if (amount > threshold) level = index;
  });
  return level;
}

/** The procedurally generated, chunked level, including fog of war and resources. */
export class World {
  private readonly chunks = new Map<string, Chunk>();
  /**
   * Bumped whenever the player learns of a new obstacle (acid or a cliff comes into view, a
   * building goes up or comes down), so units can check whether their planned routes still hold.
   */
  knownObstaclesVersion = 0;
  private readonly regions = new Map<string, Site[]>();
  private readonly explicit: SiteSpec[];
  private readonly siteGround: SiteGround;

  /** `sites` are placed by hand (by missions), on top of any the terrain generates. */
  constructor(
    private readonly terrain: TerrainGenerator,
    sites: readonly SiteSpec[] = [],
  ) {
    this.explicit = [...sites];
    this.siteGround = {
      acid: (x, y) => terrain.ground(x, y) === Terrain.Acid,
      height: (x, y) => terrain.height(x + 0.5, y + 0.5),
    };
  }

  /** The Tessilend sites whose centre lies in region (rx, ry). */
  sitesInRegion(rx: number, ry: number): Site[] {
    const key = `${rx},${ry}`;
    let sites = this.regions.get(key);
    if (sites) return sites;
    sites = [];
    const salt = this.terrain.siteSalt;
    for (const spec of this.explicit) {
      const [sx, sy] = regionOf(spec.x, spec.y);
      if (sx === rx && sy === ry) sites.push(createSite(spec, this.siteGround, salt ?? 0));
    }
    if (salt !== undefined) {
      const spec = regionSiteSpec(rx, ry, this.siteGround, salt);
      const clear =
        spec &&
        this.explicit.every((e) => Math.hypot(e.x - spec.x, e.y - spec.y) >= EXPLICIT_CLEARANCE);
      if (spec && clear) sites.push(createSite(spec, this.siteGround, salt));
    }
    this.regions.set(key, sites);
    return sites;
  }

  /** Sites whose centre is within `radius` tiles of `center`. */
  sitesNear(center: Point, radius: number): Site[] {
    const [x0, y0] = regionOf(Math.floor(center.x - radius), Math.floor(center.y - radius));
    const [x1, y1] = regionOf(Math.floor(center.x + radius), Math.floor(center.y + radius));
    const found: Site[] = [];
    for (let ry = y0; ry <= y1; ry++) {
      for (let rx = x0; rx <= x1; rx++) {
        for (const site of this.sitesInRegion(rx, ry)) {
          const d = Math.hypot(site.center.x - center.x, site.center.y - center.y);
          if (d <= radius) found.push(site);
        }
      }
    }
    return found;
  }

  /** The site standing on, or paved around, a tile. */
  siteAt(grid: GridRef, includePaving = false): Site | undefined {
    return this.sitesNear(worldFromGrid(grid.x, grid.y), SITE_REACH).find((site) => {
      const half = Math.floor(site.size / 2) + (includePaving ? 3 : 0);
      return Math.abs(grid.x - site.x) <= half && Math.abs(grid.y - site.y) <= half;
    });
  }

  /** Every site that could touch this chunk, for laying out its tiles. */
  private sitesTouching(cx: number, cy: number): Site[] {
    const x0 = cx * CHUNK_SIZE - SITE_REACH;
    const y0 = cy * CHUNK_SIZE - SITE_REACH;
    const x1 = (cx + 1) * CHUNK_SIZE + SITE_REACH;
    const y1 = (cy + 1) * CHUNK_SIZE + SITE_REACH;
    const sites: Site[] = [];
    for (let ry = Math.floor(y0 / REGION); ry <= Math.floor(y1 / REGION); ry++) {
      for (let rx = Math.floor(x0 / REGION); rx <= Math.floor(x1 / REGION); rx++) {
        sites.push(...this.sitesInRegion(rx, ry));
      }
    }
    return sites;
  }

  getChunk(cx: number, cy: number): Chunk {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunk(cx, cy);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  private generateChunk(cx: number, cy: number): Chunk {
    const chunk = new Chunk(cx, cy);
    const levels = getResourceDefinition("iron").levels;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = cx * CHUNK_SIZE + lx;
        const y = cy * CHUNK_SIZE + ly;
        const i = lx + ly * CHUNK_SIZE;

        chunk.tiles[i] = this.terrain.ground(x, y);
        const height = this.computeTileHeight(x, y);
        chunk.heights[i] = height;
        const neighbours = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const;
        chunk.cliffs[i] = neighbours.some(
          ([dx, dy]) => Math.abs(this.computeTileHeight(x + dx, y + dy) - height) > MAX_CLIMB,
        )
          ? 1
          : 0;

        const amount = this.terrain.iron(x, y);
        if (amount > 0) {
          chunk.resources[i] = {
            kind: "iron",
            amount,
            level: resourceLevel(amount, levels),
            grid: gridRef(x, y),
            position: worldFromGrid(x, y),
            exists: true,
          };
        }
      }
    }
    this.layOutSites(chunk);
    return chunk;
  }

  /** Mark the parts of any Tessilend sites that fall in this chunk. */
  private layOutSites(chunk: Chunk): void {
    const local = (x: number, y: number): number | null => {
      const lx = x - chunk.x * CHUNK_SIZE;
      const ly = y - chunk.y * CHUNK_SIZE;
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return null;
      return lx + ly * CHUNK_SIZE;
    };
    const levels = getResourceDefinition("lattice").levels;
    for (const site of this.sitesTouching(chunk.x, chunk.y)) {
      for (const [x, y] of site.footprint) {
        const i = local(x, y);
        if (i === null) continue;
        chunk.ruin[i] = 1;
        chunk.occupied[i] = (chunk.occupied[i] ?? 0) + 1;
        chunk.resources[i] = undefined;
      }
      for (const [x, y] of site.paving) {
        const i = local(x, y);
        if (i === null) continue;
        chunk.paved[i] = 1;
        chunk.resources[i] = undefined;
      }
      for (const seam of site.seams) {
        const i = local(seam.x, seam.y);
        if (i === null) continue;
        chunk.resources[i] = this.latticeResource(seam, seam.amount, levels);
      }
    }
  }

  private latticeResource(seam: Seam, amount: number, levels: readonly number[]): Resource {
    return {
      kind: "lattice",
      amount,
      level: resourceLevel(amount, levels),
      grid: gridRef(seam.x, seam.y),
      position: worldFromGrid(seam.x, seam.y),
      exists: true,
    };
  }

  /** Grow a lattice seam back by `amount`, up to its original size. */
  regrowSeam(seam: Seam, amount: number): void {
    const grid = gridRef(seam.x, seam.y);
    const chunk = this.chunkOf(grid);
    if (chunk.occupied[grid.i] !== 0) return; // something has been built over it
    const levels = getResourceDefinition("lattice").levels;
    const current = chunk.resources[grid.i];
    if (current && current.kind !== "lattice") return;
    const next = Math.min(seam.amount, (current?.amount ?? 0) + amount);
    if (next === current?.amount) return;
    if (current) {
      current.amount = next;
      const level = resourceLevel(next, levels);
      if (level !== current.level) {
        current.level = level;
        chunk.version++;
      }
    } else {
      const resource = this.latticeResource(seam, next, levels);
      if (resource.level < 0) return; // not yet big enough to see or mine
      chunk.resources[grid.i] = resource;
      chunk.version++;
    }
  }

  private computeTileHeight(x: number, y: number): number {
    return this.terrain.height(x + 0.5, y + 0.5);
  }

  /** Ground height at any point on the map (continuous, for placing things in 3D). */
  heightAt(x: number, y: number): number {
    return this.terrain.height(x, y);
  }

  /** Ground height at a tile's centre. */
  tileHeight(grid: GridRef): number {
    return this.chunkOf(grid).heights[grid.i] ?? 0;
  }

  /** Whether a ground unit can step between two neighbouring tiles (not up or down a cliff). */
  canClimb(from: GridRef, to: GridRef): boolean {
    return Math.abs(this.tileHeight(from) - this.tileHeight(to)) <= MAX_CLIMB;
  }

  /** `canClimb` as far as the player knows: cliffs in unexplored ground are unknown. */
  knownCanClimb(from: GridRef, to: GridRef): boolean {
    if (!this.isExplored(from) || !this.isExplored(to)) return true;
    return this.canClimb(from, to);
  }

  private chunkOf(grid: GridRef): Chunk {
    return this.getChunk(grid.chunkX, grid.chunkY);
  }

  isExplored(grid: GridRef): boolean {
    return this.chunkOf(grid).explored[grid.i] === 1;
  }

  isVisible(grid: GridRef): boolean {
    return (this.chunkOf(grid).watchers[grid.i] ?? 0) > 0;
  }

  /** Whether ground units can stand on or walk through a tile: no acid and no building. */
  isPassable(grid: GridRef): boolean {
    const chunk = this.chunkOf(grid);
    return chunk.tiles[grid.i] !== Terrain.Acid && chunk.occupied[grid.i] === 0;
  }

  /**
   * Passability as far as the player knows, which is what routes are planned on: unexplored
   * ground is assumed walkable, while the player's own buildings are always known.
   */
  isKnownPassable(grid: GridRef): boolean {
    const chunk = this.chunkOf(grid);
    // Ruins in unexplored ground are as unknown as acid there.
    if (chunk.explored[grid.i] === 0)
      return chunk.ruin[grid.i] === 1 || chunk.occupied[grid.i] === 0;
    if (chunk.occupied[grid.i] !== 0) return false;
    return chunk.tiles[grid.i] !== Terrain.Acid;
  }

  /** Whether a tile is Tessilend foundation. */
  isPaved(grid: GridRef): boolean {
    return this.chunkOf(grid).paved[grid.i] === 1;
  }

  /** Whether a building may be placed on this tile: explored, passable ground. */
  isBuildable(grid: GridRef): boolean {
    return this.isExplored(grid) && this.isPassable(grid);
  }

  /** Mark tiles as covered (`delta` 1) or freed (`delta` -1) by a building. */
  occupy(tiles: readonly GridRef[], delta: 1 | -1): void {
    if (tiles.length > 0) this.knownObstaclesVersion++;
    for (const tile of tiles) {
      const chunk = this.chunkOf(tile);
      chunk.occupied[tile.i] = Math.max(0, (chunk.occupied[tile.i] ?? 0) + delta);
      chunk.version++; // scenery under a building is hidden
    }
  }

  /** The resource on a tile, if the tile is explored and the resource still exists. */
  resourceAt(grid: GridRef): Resource | undefined {
    if (!this.isExplored(grid)) return undefined;
    const resource = this.chunkOf(grid).resources[grid.i];
    return resource?.exists ? resource : undefined;
  }

  /** Start watching the tiles within `radius` of `center`: they become explored and visible. */
  watch(center: GridRef, radius: number): void {
    this.forEachInRadius(center, radius, (chunk, i) => {
      chunk.watchers[i] = (chunk.watchers[i] ?? 0) + 1;
      if (chunk.explored[i] === 0) {
        chunk.explored[i] = 1;
        if (chunk.tiles[i] === Terrain.Acid || chunk.cliffs[i] === 1 || chunk.ruin[i] === 1) {
          this.knownObstaclesVersion++;
        }
      }
    });
  }

  /** Stop watching tiles; they stay explored but are fogged once nobody watches them. */
  unwatch(center: GridRef, radius: number): void {
    this.forEachInRadius(center, radius, (chunk, i) => {
      chunk.watchers[i] = Math.max(0, (chunk.watchers[i] ?? 0) - 1);
    });
  }

  private forEachInRadius(
    center: GridRef,
    radius: number,
    fn: (chunk: Chunk, i: number) => void,
  ): void {
    const touched = new Set<Chunk>();
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      for (let y = center.y - radius; y <= center.y + radius; y++) {
        const grid = gridRef(x, y);
        const chunk = this.chunkOf(grid);
        fn(chunk, grid.i);
        touched.add(chunk);
      }
    }
    for (const chunk of touched) chunk.version++;
  }

  /** Remove up to `amount` from a resource. Returns how much was actually taken. */
  gather(resource: Resource, amount: number): number {
    const taken = Math.min(amount, resource.amount);
    resource.amount -= taken;

    const level = resourceLevel(resource.amount, getResourceDefinition(resource.kind).levels);
    if (level !== resource.level) {
      resource.level = level;
      this.chunkOf(resource.grid).version++;
    }
    if (level === -1) {
      resource.exists = false;
      this.chunkOf(resource.grid).resources[resource.grid.i] = undefined;
    }
    return taken;
  }
}
