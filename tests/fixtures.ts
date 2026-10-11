import { type GridRef, gridRef } from "../src/game/coords";
import { Terrain } from "../src/game/terrain";
import { World } from "../src/game/world";

/** Flat dirt everywhere, no iron. */
export const openWorld = () => new World(() => -1);

/** Flat dirt with iron on every tile: 0.5 is below the sand band but sin(0.5) > 0.4. */
export const ironWorld = () => new World(() => 0.5);

/** Turn tiles into acid, which ground units can't cross. */
export function acid(world: World, tiles: readonly [number, number][]): void {
  for (const [x, y] of tiles) {
    const tile = gridRef(x, y);
    world.getChunk(tile.chunkX, tile.chunkY).tiles[tile.i] = Terrain.Acid;
  }
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
