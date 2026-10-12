import { type GridRef, gridRef } from "../src/game/coords";
import { Terrain, type TerrainGenerator, type TerrainType } from "../src/game/terrain";
import { World } from "../src/game/world";

/** A test terrain: dirt everywhere at height 0 unless overridden. */
export function terrain(overrides: Partial<TerrainGenerator> = {}): TerrainGenerator {
  return {
    ground: () => Terrain.Dirt,
    height: () => 0,
    iron: () => 0,
    ...overrides,
  };
}

/** Flat dirt everywhere, no iron. */
export const openWorld = () => new World(terrain());

/** Flat dirt with iron on every tile. */
export const ironWorld = () => new World(terrain({ iron: () => 1200 }));

/** Flat ground with acid on the given tiles. */
export function worldWithAcid(tiles: readonly [number, number][]): World {
  const acid = new Set(tiles.map(([x, y]) => `${x},${y}`));
  return new World(
    terrain({
      ground: (x, y): TerrainType => (acid.has(`${x},${y}`) ? Terrain.Acid : Terrain.Dirt),
    }),
  );
}

/** Flat ground with a plateau `height` tall over x ≥ `edge`: a cliff along x = edge. */
export function worldWithCliff(edge: number, height = 3): World {
  return new World(terrain({ height: (x) => (x >= edge ? height : 0) }));
}

/** Block tiles as if a building stood on them. */
export function wall(world: World, tiles: readonly [number, number][]): GridRef[] {
  const refs = tiles.map(([x, y]) => gridRef(x, y));
  world.occupy(refs, 1);
  return refs;
}

/** Every tile in the rectangle spanned by two corner tiles. */
export function area(from: [number, number], to: [number, number]): [number, number][] {
  const tiles: [number, number][] = [];
  const [x0, y0] = from;
  const [x1, y1] = to;
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) tiles.push([x, y]);
  }
  return tiles;
}

/** Explore a square of tiles, so the player knows what's there. */
export function explore(world: World, center: [number, number], radius: number): void {
  world.watch(gridRef(center[0], center[1]), radius);
}
