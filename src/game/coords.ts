import { CHUNK_SIZE, TILE_HEIGHT, TILE_WIDTH } from "./config";

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

/** World position of the centre of tile (x, y). */
export function worldFromGrid(x: number, y: number): Point {
  return {
    x: (x - y) * (TILE_WIDTH / 2) + TILE_WIDTH / 2,
    y: (x + y) * (TILE_HEIGHT / 2) + TILE_HEIGHT / 2,
  };
}

/** The tile containing a world position. */
export function gridFromWorld(point: Point): GridRef {
  const x = point.x - TILE_WIDTH / 2;
  return gridRef(
    Math.floor(x / TILE_WIDTH + point.y / TILE_HEIGHT),
    Math.floor(point.y / TILE_HEIGHT - x / TILE_WIDTH),
  );
}

/** Convert a screen position to world space for a camera offset. */
export function worldFromScreen(screen: Point, camera: Point): Point {
  return { x: screen.x - camera.x, y: screen.y - camera.y };
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
