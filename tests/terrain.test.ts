import { describe, expect, it } from "vitest";
import { baseTerrain, createNoise, ironAmount, Terrain, terrainTile } from "../src/game/terrain";

/** Noise that yields the given terrain per tile (keyed "x,y"), and dirt elsewhere. */
function fakeNoise(map: Record<string, number>) {
  // baseTerrain samples noise(x / 150, y / 150): round(n * 20) - 15 → 2 = sand, 3+ = acid.
  const valueFor = { [Terrain.Dirt]: 0, [Terrain.Sand]: 17 / 20, [Terrain.Acid]: 18 / 20 };
  return (nx: number, ny: number) => {
    const key = `${Math.round(nx * 150)},${Math.round(ny * 150)}`;
    const terrain = map[key] ?? Terrain.Dirt;
    return valueFor[terrain as keyof typeof valueFor];
  };
}

describe("baseTerrain", () => {
  it("maps noise bands to dirt, sand and acid", () => {
    expect(baseTerrain(() => 0, 0, 0)).toBe(Terrain.Dirt);
    expect(baseTerrain(() => 17 / 20, 0, 0)).toBe(Terrain.Sand);
    expect(baseTerrain(() => 18 / 20, 0, 0)).toBe(Terrain.Acid);
    expect(baseTerrain(() => 1, 0, 0)).toBe(Terrain.Acid);
    expect(baseTerrain(() => -1, 0, 0)).toBe(Terrain.Dirt);
  });
});

describe("terrainTile", () => {
  it("leaves dirt and acid tiles as they are", () => {
    expect(terrainTile(fakeNoise({}), 0, 0)).toBe(Terrain.Dirt);
    expect(terrainTile(fakeNoise({ "0,0": Terrain.Acid }), 0, 0)).toBe(Terrain.Acid);
  });

  it("uses a border tile for sand with dirt to the left", () => {
    const noise = fakeNoise({
      "0,0": Terrain.Sand,
      "0,-1": Terrain.Sand,
      "1,-1": Terrain.Sand,
      "1,0": Terrain.Sand,
      "0,1": Terrain.Sand,
      "1,1": Terrain.Sand,
      "-1,-1": Terrain.Sand,
      "-1,1": Terrain.Sand,
    });
    expect(terrainTile(noise, 0, 0)).toBe(1);
  });

  it("keeps sand fully surrounded by sand", () => {
    const map: Record<string, number> = {};
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) map[`${x},${y}`] = Terrain.Sand;
    expect(terrainTile(fakeNoise(map), 0, 0)).toBe(Terrain.Sand);
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
