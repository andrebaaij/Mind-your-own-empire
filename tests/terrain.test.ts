import { describe, expect, it } from "vitest";
import { gridRef } from "../src/game/coords";
import { findTilePath } from "../src/game/pathfinding";
import {
  baseTerrain,
  createNoise,
  ironAmount,
  noiseTerrain,
  START_CENTER,
  Terrain,
  terrainHeight,
} from "../src/game/terrain";
import { World } from "../src/game/world";

describe("baseTerrain", () => {
  it("maps noise bands to dirt, sand and acid", () => {
    expect(baseTerrain(() => 0, 0, 0)).toBe(Terrain.Dirt);
    expect(baseTerrain(() => 17 / 20, 0, 0)).toBe(Terrain.Sand);
    expect(baseTerrain(() => 18 / 20, 0, 0)).toBe(Terrain.Acid);
    expect(baseTerrain(() => 1, 0, 0)).toBe(Terrain.Acid);
    expect(baseTerrain(() => -1, 0, 0)).toBe(Terrain.Dirt);
  });
});

describe("terrainHeight", () => {
  const noise = createNoise("1500");

  it("is flat around the starting base", () => {
    for (let dx = -8; dx <= 8; dx += 2) {
      for (let dy = -8; dy <= 8; dy += 2) {
        if (Math.hypot(dx, dy) > 8.5) continue;
        expect(terrainHeight(noise, START_CENTER.x + dx, START_CENTER.y + dy)).toBeCloseTo(0, 9);
      }
    }
  });

  it("has hills further out", () => {
    const heights = Array.from({ length: 400 }, (_, i) =>
      terrainHeight(noise, 40 + (i % 20) * 3, 40 + Math.floor(i / 20) * 3),
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(1);
  });

  it("is continuous, so neighbouring points are at similar heights", () => {
    for (let i = 0; i < 100; i++) {
      const x = 30 + i * 0.7;
      const y = -20 + i * 0.3;
      expect(Math.abs(terrainHeight(noise, x, y) - terrainHeight(noise, x + 0.01, y))).toBeLessThan(
        0.05,
      );
    }
  });
});

describe("seeded noise", () => {
  it("is deterministic per seed", () => {
    const a = createNoise("1500");
    const b = createNoise("1500");
    const c = createNoise("1501");
    expect(a(1.5, 2.5)).toBe(b(1.5, 2.5));
    expect(a(1.5, 2.5)).not.toBe(c(1.5, 2.5));
  });

  it("produces iron in some places and not others", () => {
    const noise = createNoise("1500");
    const amounts = Array.from({ length: 200 }, (_, i) => ironAmount(noise, i * 7, i * 13));
    expect(amounts.some((a) => a > 0)).toBe(true);
    expect(amounts.some((a) => a <= 0)).toBe(true);
  });
});

describe("generated maps", () => {
  it("have some cliffs and stay connected", () => {
    const world = new World(noiseTerrain(createNoise("1500")));
    let cliffs = 0;
    let tiles = 0;
    for (let y = -60; y < 60; y++) {
      for (let x = -60; x < 60; x++) {
        const tile = gridRef(x, y);
        tiles++;
        if (world.getChunk(tile.chunkX, tile.chunkY).cliffs[tile.i] === 1) cliffs++;
      }
    }
    expect(cliffs / tiles).toBeGreaterThan(0.02);
    expect(cliffs / tiles).toBeLessThan(0.15);

    // Once everything is known, open ground far from the base can still be reached from it.
    world.watch(gridRef(0, 0), 60);
    for (const [x, y] of [
      [50, 40],
      [-45, 30],
      [35, -50],
      [-40, -40],
    ] as const) {
      const goal = gridRef(x, y);
      if (!world.isPassable(goal)) continue;
      expect(findTilePath(world, gridRef(5, 9), goal).at(-1)).toMatchObject({ x, y });
    }
  });
});
