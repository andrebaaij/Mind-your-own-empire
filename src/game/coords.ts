import { CHUNK_SIZE } from "./config";

/**
 * A position on the ground plane, in tiles. Tile (x, y) covers [x, x + 1) × [y, y + 1).
 * In 3D, `x` maps to the scene's x axis and `y` to its z axis; height is separate.
 */
export interface Point {
  x: number;
  y: number;
}

/** A tile position, plus the chunk it lives in and its index within that chunk. */
export interface GridRef {
  x: number;
  y: number;
  chunkX: number;
  chunkY: number;
  /** Index of the tile inside its chunk (`localX + localY * CHUNK_SIZE`). */
  i: number;
}

export function gridRef(x: number, y: number): GridRef {
  const chunkX = Math.floor(x / CHUNK_SIZE);
  const chunkY = Math.floor(y / CHUNK_SIZE);
  return {
    x,
    y,
    chunkX,
    chunkY,
    i: x - chunkX * CHUNK_SIZE + (y - chunkY * CHUNK_SIZE) * CHUNK_SIZE,
  };
}

/** Ground position of the centre of tile (x, y). */
export function worldFromGrid(x: number, y: number): Point {
  return { x: x + 0.5, y: y + 0.5 };
}

/** The tile containing a ground position. */
export function gridFromWorld(point: Point): GridRef {
  return gridRef(Math.floor(point.x), Math.floor(point.y));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

export function rectContains(rect: Rect, point: Point): boolean {
  return (
    rect.left <= point.x && point.x <= rect.right && rect.top <= point.y && point.y <= rect.bottom
  );
}

/** Inclusive range of tiles spanned by two corner tiles. */
export function gridRange(a: GridRef, b: GridRef): GridRef[] {
  const tiles: GridRef[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
      tiles.push(gridRef(x, y));
    }
  }
  return tiles;
}
