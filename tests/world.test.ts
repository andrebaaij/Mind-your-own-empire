import { describe, expect, it } from "vitest";
import { gridRef } from "../src/game/coords";
import { getResourceDefinition } from "../src/game/definitions";
import { resourceLevel, World } from "../src/game/world";

/** A world where every tile holds iron: sin(1) - 0.4 > 0. */
const ironEverywhere = () => new World(() => 1);
/** A world without any iron: sin(-1) - 0.4 < 0. */
const noIron = () => new World(() => -1);

describe("resourceLevel", () => {
  const levels = [0, 500, 1000];

  it("is the highest threshold the amount exceeds", () => {
    expect(resourceLevel(1, levels)).toBe(0);
    expect(resourceLevel(500, levels)).toBe(0);
    expect(resourceLevel(501, levels)).toBe(1);
    expect(resourceLevel(5000, levels)).toBe(2);
  });

  it("is -1 once nothing is left", () => {
    expect(resourceLevel(0, levels)).toBe(-1);
  });
});

describe("fog of war", () => {
  it("starts unexplored", () => {
    const world = noIron();
    expect(world.isExplored(gridRef(0, 0))).toBe(false);
    expect(world.isVisible(gridRef(0, 0))).toBe(false);
  });

  it("reveals a square of tiles around a watcher, across chunk borders", () => {
    const world = noIron();
    world.watch(gridRef(0, 0), 2);
    expect(world.isVisible(gridRef(-2, -2))).toBe(true);
    expect(world.isVisible(gridRef(2, 2))).toBe(true);
    expect(world.isVisible(gridRef(3, 0))).toBe(false);
  });

  it("keeps tiles explored but fogged after the last watcher leaves", () => {
    const world = noIron();
    world.watch(gridRef(0, 0), 1);
    world.watch(gridRef(1, 0), 1);
    world.unwatch(gridRef(0, 0), 1);

    expect(world.isVisible(gridRef(0, 0))).toBe(true); // still seen by the second watcher
    expect(world.isVisible(gridRef(-1, 0))).toBe(false);
    expect(world.isExplored(gridRef(-1, 0))).toBe(true);
  });

  it("marks touched chunks as changed", () => {
    const world = noIron();
    const chunk = world.getChunk(0, 0);
    const before = chunk.version;
    world.watch(gridRef(5, 5), 1);
    expect(chunk.version).toBeGreaterThan(before);
  });
});

describe("resources", () => {
  it("hides resources on unexplored tiles", () => {
    const world = ironEverywhere();
    expect(world.resourceAt(gridRef(0, 0))).toBeUndefined();
    world.watch(gridRef(0, 0), 0);
    expect(world.resourceAt(gridRef(0, 0))?.kind).toBe("iron");
  });

  it("depletes and removes a resource", () => {
    const world = ironEverywhere();
    world.watch(gridRef(0, 0), 0);
    const resource = world.resourceAt(gridRef(0, 0));
    if (!resource) throw new Error("expected iron");

    const total = resource.amount;
    expect(world.gather(resource, 10)).toBe(10);
    expect(resource.amount).toBe(total - 10);

    expect(world.gather(resource, Number.POSITIVE_INFINITY)).toBe(total - 10);
    expect(resource.exists).toBe(false);
    expect(resource.level).toBe(-1);
    expect(world.resourceAt(gridRef(0, 0))).toBeUndefined();
  });

  it("updates the visual level as the amount drops", () => {
    const world = ironEverywhere();
    world.watch(gridRef(0, 0), 0);
    const resource = world.resourceAt(gridRef(0, 0));
    if (!resource) throw new Error("expected iron");

    const { levels } = getResourceDefinition("iron");
    world.gather(resource, resource.amount - ((levels[1] ?? 0) - 1));
    expect(resource.level).toBe(0);
  });
});
