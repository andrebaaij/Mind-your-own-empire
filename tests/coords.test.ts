import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../src/game/config";
import {
  gridFromWorld,
  gridRange,
  gridRef,
  rectContains,
  rectFromPoints,
  worldFromGrid,
} from "../src/game/coords";

describe("isometric coordinates", () => {
  it("places tile (0, 0) with its centre at (32, 16)", () => {
    expect(worldFromGrid(0, 0)).toEqual({ x: 32, y: 16 });
  });

  it("steps half a tile right and down per grid x, half left and down per grid y", () => {
    expect(worldFromGrid(1, 0)).toEqual({ x: 64, y: 32 });
    expect(worldFromGrid(0, 1)).toEqual({ x: 0, y: 32 });
  });

  it("round-trips tile centres for positive and negative tiles", () => {
    for (let x = -25; x <= 25; x += 5) {
      for (let y = -25; y <= 25; y += 5) {
        const grid = gridFromWorld(worldFromGrid(x, y));
        expect([grid.x, grid.y]).toEqual([x, y]);
      }
    }
  });
});

describe("gridRef", () => {
  it("indexes tiles within their chunk", () => {
    expect(gridRef(0, 0)).toMatchObject({ chunkX: 0, chunkY: 0, i: 0 });
    expect(gridRef(3, 2)).toMatchObject({ chunkX: 0, chunkY: 0, i: 3 + 2 * CHUNK_SIZE });
    expect(gridRef(CHUNK_SIZE, 0)).toMatchObject({ chunkX: 1, chunkY: 0, i: 0 });
  });

  it("puts negative tiles in negative chunks", () => {
    expect(gridRef(-1, -1)).toMatchObject({
      chunkX: -1,
      chunkY: -1,
      i: CHUNK_SIZE - 1 + (CHUNK_SIZE - 1) * CHUNK_SIZE,
    });
  });
});

describe("rectangles", () => {
  it("normalises corners regardless of drag direction", () => {
    expect(rectFromPoints({ x: 10, y: 5 }, { x: 0, y: 20 })).toEqual({
      left: 0,
      top: 5,
      right: 10,
      bottom: 20,
    });
  });

  it("contains points on its edges", () => {
    const rect = rectFromPoints({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(rectContains(rect, { x: 10, y: 0 })).toBe(true);
    expect(rectContains(rect, { x: 11, y: 0 })).toBe(false);
  });

  it("covers every tile between two corners", () => {
    const tiles = gridRange(gridRef(2, 1), gridRef(0, 0)).map((t) => [t.x, t.y]);
    expect(tiles).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
  });
});
