import { describe, expect, it } from "vitest";
import {
  BIOMES,
  type Biome,
  dominantBiome,
  FEATURE_RADIUS,
  type Sinkhole,
} from "../src/game/biomes";
import { gridRef } from "../src/game/coords";
import { findTilePath } from "../src/game/pathfinding";
import { createNoise, noiseTerrain, START_CENTER, Terrain } from "../src/game/terrain";
import { World } from "../src/game/world";

const terrain = noiseTerrain(createNoise("1500"), "1500");

describe("regions", () => {
  it("keeps the land around the start as rust desert", () => {
    for (let dx = -20; dx <= 20; dx += 5) {
      for (let dy = -20; dy <= 20; dy += 5) {
        if (Math.hypot(dx, dy) > 22) continue;
        const weights = terrain.biome?.(START_CENTER.x + dx, START_CENTER.y + dy);
        expect(weights?.rust).toBeCloseTo(1, 5);
      }
    }
  });

  it("has every region somewhere, none of them everywhere", () => {
    const counts: Record<Biome, number> = { rust: 0, dunes: 0, ash: 0, salt: 0, lush: 0 };
    let total = 0;
    for (let y = -900; y <= 900; y += 15) {
      for (let x = -900; x <= 900; x += 15) {
        const weights = terrain.biome?.(x, y);
        if (!weights) throw new Error("no regions");
        counts[dominantBiome(weights)]++;
        total++;
        const sum = BIOMES.reduce((n, biome) => n + weights[biome], 0);
        expect(sum).toBeCloseTo(1, 5);
      }
    }
    for (const biome of BIOMES) {
      expect(counts[biome] / total, biome).toBeGreaterThan(0.05);
      expect(counts[biome] / total, biome).toBeLessThan(0.5);
    }
  });
});

describe("water and sinkholes", () => {
  it("never appear where the missions play", () => {
    for (let y = -55; y <= 55; y++) {
      for (let x = -55; x <= 55; x++) {
        expect(terrain.ground(x, y)).not.toBe(Terrain.Water);
      }
    }
    expect(terrain.sinkholes?.(START_CENTER.x, START_CENTER.y, FEATURE_RADIUS - 10)).toEqual([]);
  });

  it("include oasis pools somewhere out in the lush country", () => {
    let water = 0;
    for (let y = -600; y <= 600; y += 2) {
      for (let x = -600; x <= 600; x += 2) if (terrain.ground(x, y) === Terrain.Water) water++;
    }
    expect(water).toBeGreaterThan(50);
  });

  it("sinkholes: cliffs all round, a pool at the bottom, and a ramp that reaches it", () => {
    const holes = terrain.sinkholes?.(0, 0, 500) ?? [];
    expect(holes.length).toBeGreaterThan(3);
    for (const hole of holes.slice(0, 5)) checkSinkhole(hole);
  });
});

function checkSinkhole(hole: Sinkhole): void {
  {
    const world = new World(terrain);
    const centre = gridRef(Math.floor(hole.x), Math.floor(hole.y));
    world.watch(centre, Math.ceil(hole.radius + 16));

    // Deep, with a pool in the middle.
    const rim = terrain.height(hole.x + hole.radius + 3, hole.y);
    expect(rim - terrain.height(hole.x + 3, hole.y)).toBeGreaterThan(2.5);
    expect(world.isPassable(centre)).toBe(false);

    // Walls: most of the way round, the edge is a cliff.
    let cliffs = 0;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const tile = gridRef(
        Math.floor(hole.x + Math.cos(a) * (hole.radius - 0.5)),
        Math.floor(hole.y + Math.sin(a) * (hole.radius - 0.5)),
      );
      if (world.getChunk(tile.chunkX, tile.chunkY).cliffs[tile.i] === 1) cliffs++;
    }
    expect(cliffs).toBeGreaterThan(14);

    // A walker can get down the ramp to the garden by the pool.
    const outside = gridRef(
      Math.floor(hole.x + Math.cos(hole.ramp) * (hole.radius + 12)),
      Math.floor(hole.y + Math.sin(hole.ramp) * (hole.radius + 12)),
    );
    const floor = gridRef(
      Math.floor(hole.x + Math.cos(hole.ramp) * hole.radius * 0.6),
      Math.floor(hole.y + Math.sin(hole.ramp) * hole.radius * 0.6),
    );
    expect(world.isPassable(floor)).toBe(true);
    expect(findTilePath(world, outside, floor).at(-1)).toMatchObject({ x: floor.x, y: floor.y });
  }
}
