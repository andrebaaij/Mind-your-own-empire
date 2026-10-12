import { describe, expect, it } from "vitest";
import { gridRef } from "../src/game/coords";
import { getResourceDefinition } from "../src/game/definitions";
import { resourceLevel } from "../src/game/world";
import { explore, ironWorld, openWorld, worldWithAcid, worldWithCliff } from "./fixtures";

const ironEverywhere = ironWorld;
const noIron = openWorld;

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

describe("passability", () => {
  it("blocks acid and tiles under buildings", () => {
    const world = worldWithAcid([[1, 0]]);
    world.occupy([gridRef(2, 0)], 1);

    expect(world.isPassable(gridRef(0, 0))).toBe(true);
    expect(world.isPassable(gridRef(1, 0))).toBe(false);
    expect(world.isPassable(gridRef(2, 0))).toBe(false);

    world.occupy([gridRef(2, 0)], -1);
    expect(world.isPassable(gridRef(2, 0))).toBe(true);
  });

  it("only allows building on explored, passable ground", () => {
    const world = openWorld();
    expect(world.isBuildable(gridRef(0, 0))).toBe(false);
    world.watch(gridRef(0, 0), 1);
    expect(world.isBuildable(gridRef(0, 0))).toBe(true);
    world.occupy([gridRef(0, 0)], 1);
    expect(world.isBuildable(gridRef(0, 0))).toBe(false);
  });
});

describe("height and cliffs", () => {
  it("stores tile heights and marks both sides of a cliff", () => {
    const world = worldWithCliff(5);
    expect(world.tileHeight(gridRef(4, 0))).toBe(0);
    expect(world.tileHeight(gridRef(5, 0))).toBe(3);
    expect(world.getChunk(0, 0).cliffs[4]).toBe(1);
    expect(world.getChunk(0, 0).cliffs[5]).toBe(1);
    expect(world.getChunk(0, 0).cliffs[2]).toBe(0);
  });

  it("only lets ground units climb gentle steps", () => {
    const world = worldWithCliff(5);
    expect(world.canClimb(gridRef(3, 0), gridRef(4, 0))).toBe(true);
    expect(world.canClimb(gridRef(4, 0), gridRef(5, 0))).toBe(false);
  });

  it("doesn't reveal cliffs the player hasn't explored", () => {
    const world = worldWithCliff(5);
    expect(world.knownCanClimb(gridRef(4, 0), gridRef(5, 0))).toBe(true);
    explore(world, [5, 0], 1);
    expect(world.knownCanClimb(gridRef(4, 0), gridRef(5, 0))).toBe(false);
  });

  it("counts discovering a cliff or acid as learning of a new obstacle", () => {
    const cliff = worldWithCliff(5);
    const before = cliff.knownObstaclesVersion;
    explore(cliff, [0, 0], 1); // no cliff here
    expect(cliff.knownObstaclesVersion).toBe(before);
    explore(cliff, [5, 0], 0);
    expect(cliff.knownObstaclesVersion).toBeGreaterThan(before);

    const acid = worldWithAcid([[3, 3]]);
    explore(acid, [3, 3], 0);
    expect(acid.knownObstaclesVersion).toBeGreaterThan(0);
  });
});
