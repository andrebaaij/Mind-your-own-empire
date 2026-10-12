import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../src/game/config";
import { generateDecor, hash, valueNoise } from "../src/game/scenery";
import { createNoise, noiseTerrain, START_CENTER, Terrain } from "../src/game/terrain";
import { World } from "../src/game/world";
import { terrain, worldWithAcid } from "./fixtures";

const lessuin = () => new World(noiseTerrain(createNoise("lessuin")));

/** All scenery in a square of chunks around the start. */
function decorAround(world: World, radius: number) {
  const items = [];
  for (let cy = -radius; cy <= radius; cy++) {
    for (let cx = -radius; cx <= radius; cx++)
      items.push(...generateDecor(world, world.getChunk(cx, cy)));
  }
  return items;
}

describe("scenery randomness", () => {
  it("is repeatable and stays in [0, 1)", () => {
    expect(hash(3, -7, 11)).toBe(hash(3, -7, 11));
    expect(hash(3, -7, 11)).not.toBe(hash(3, -7, 12));
    for (let i = 0; i < 200; i++) {
      const h = hash(i, i * 7 - 50, i % 13);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      const n = valueNoise(i / 3.7, -i / 5.1, 2);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});

describe("generateDecor", () => {
  it("places the same scenery every time for the same world", () => {
    const a = generateDecor(lessuin(), lessuin().getChunk(3, -2));
    const b = generateDecor(lessuin(), lessuin().getChunk(3, -2));
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it("keeps every item inside its own tile, on the ground", () => {
    const world = lessuin();
    const chunk = world.getChunk(2, 1);
    for (const item of generateDecor(world, chunk)) {
      const tx = chunk.x * CHUNK_SIZE + (item.tile % CHUNK_SIZE);
      const ty = chunk.y * CHUNK_SIZE + Math.floor(item.tile / CHUNK_SIZE);
      expect(item.x).toBeGreaterThanOrEqual(tx);
      expect(item.x).toBeLessThan(tx + 1);
      expect(item.y).toBeGreaterThanOrEqual(ty);
      expect(item.y).toBeLessThan(ty + 1);
      expect(item.height).toBeCloseTo(world.heightAt(item.x, item.y));
    }
  });

  it("grows nothing in the acid", () => {
    const tiles: [number, number][] = [];
    for (let y = 20; y < 30; y++) for (let x = 20; x < 30; x++) tiles.push([x, y]);
    const world = worldWithAcid(tiles);
    expect(generateDecor(world, world.getChunk(2, 2))).toEqual([]);
    expect(world.getChunk(2, 2).tiles.every((t) => t === Terrain.Acid)).toBe(true);
  });

  it("strews wreckage around the crash site and leaves the base open for building", () => {
    const items = decorAround(new World(terrain()), 1);
    const near = items.filter(
      (item) => Math.hypot(item.x - START_CENTER.x, item.y - START_CENTER.y) < 5,
    );
    expect(near.some((item) => item.kind === "debris")).toBe(true);
    expect(near.every((item) => item.kind === "debris")).toBe(true);
    const base = items.filter((item) => {
      const d = Math.hypot(item.x - START_CENTER.x, item.y - START_CENTER.y);
      return d > 7 && d < 8.5;
    });
    expect(base.every((item) => item.kind === "grass" || item.kind === "debris")).toBe(true);
  });

  it("makes the land lively but keeps ruins rare", () => {
    const items = decorAround(lessuin(), 6);
    const count = (kind: string) => items.filter((item) => item.kind === kind).length;
    const tiles = 13 * 13 * CHUNK_SIZE * CHUNK_SIZE;
    expect(count("grass")).toBeGreaterThan(tiles * 0.05);
    expect(count("rock")).toBeGreaterThan(0);
    expect(count("tree")).toBeGreaterThan(0);
    expect(count("lantern")).toBe(count("bulb"));
    const ruins = count("column") + count("arch");
    expect(ruins).toBeGreaterThan(0);
    expect(ruins).toBeLessThan(tiles * 0.01);
  });

  it("puts rocks, not plants, on cliffs", () => {
    const world = lessuin();
    for (const chunk of [world.getChunk(4, 4), world.getChunk(-5, 3), world.getChunk(6, -6)]) {
      for (const item of generateDecor(world, chunk)) {
        if (chunk.cliffs[item.tile] === 1) expect(item.kind).toBe("rock");
      }
    }
  });
});
