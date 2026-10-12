import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { gridRef, worldFromGrid } from "../src/game/coords";
import { getObjectDefinition } from "../src/game/definitions";
import {
  cancelNextAction,
  createUnit,
  footprintTiles,
  queueGather,
  queueWalk,
  type Unit,
  updateUnit,
} from "../src/game/units";
import { World } from "../src/game/world";
import {
  area,
  explore,
  ironWorld,
  openWorld,
  terrain,
  wall,
  worldWithAcid,
  worldWithCliff,
} from "./fixtures";

function runUntilIdle(world: World, unit: Unit, others: Unit[] = [unit], maxTicks = 10_000) {
  let ticks = 0;
  while (unit.actions.length > 0 && ticks < maxTicks) {
    updateUnit(world, unit, others);
    ticks++;
  }
  return ticks;
}

/** Tick every unit until all are idle. */
function runAll(world: World, units: Unit[], maxTicks = 10_000) {
  let ticks = 0;
  while (units.some((u) => u.actions.length > 0) && ticks < maxTicks) {
    for (const unit of units) updateUnit(world, unit, units);
    ticks++;
  }
  return ticks;
}

/** Walk a unit to the end, checking every step it takes against `check`. */
function walkChecking(world: World, unit: Unit, check: () => void, others: Unit[] = [unit]) {
  let ticks = 0;
  while (unit.actions.length > 0 && ticks++ < 10_000) {
    updateUnit(world, unit, others);
    check();
  }
}

describe("footprintTiles", () => {
  it("covers a single tile for small buildings", () => {
    expect(footprintTiles(getObjectDefinition("solar"), 3, 4).map((t) => [t.x, t.y])).toEqual([
      [3, 4],
    ]);
  });

  it("covers a 3 × 3 square under the Mind", () => {
    const tiles = footprintTiles(getObjectDefinition("mind"), 0, 0).map((t) => `${t.x},${t.y}`);
    expect(tiles).toHaveLength(9);
    expect(tiles).toContain("-1,-1");
    expect(tiles).toContain("1,1");
  });
});

describe("createUnit", () => {
  it("spawns at the centre of its tile and reveals its surroundings", () => {
    const world = openWorld();
    const unit = createUnit(world, "tower", 4, 2, WHITE);
    expect(unit.position).toEqual(worldFromGrid(4, 2));
    expect(world.isVisible(gridRef(4 + 3, 2 + 3))).toBe(true);
    expect(world.isVisible(gridRef(4 + 4, 2))).toBe(false);
  });

  it("blocks the ground under buildings but not under mobile units", () => {
    const world = openWorld();
    createUnit(world, "mind", 5, 5, WHITE);
    createUnit(world, "block", 0, 0, WHITE);
    expect(world.isPassable(gridRef(6, 6))).toBe(false);
    expect(world.isPassable(gridRef(0, 0))).toBe(true);
  });
});

describe("walking", () => {
  it("arrives exactly at the target at its own speed, then stops", () => {
    const world = openWorld();
    const unit = createUnit(world, "block", 0, 0, WHITE);
    const target = { x: unit.position.x + 3.3, y: unit.position.y - 1.5 };

    queueWalk(unit, target);
    const ticks = runUntilIdle(world, unit);

    // 3.6 tiles at 3 tiles per second is about 72 ticks.
    expect(unit.position).toEqual(target);
    expect(ticks).toBeGreaterThan(60);
    expect(ticks).toBeLessThan(90);
    updateUnit(world, unit, [unit]);
    expect(unit.moving).toBe(false);
  });

  it("faces the way it is moving", () => {
    const world = openWorld();
    const unit = createUnit(world, "block", 0, 0, WHITE);
    queueWalk(unit, { x: unit.position.x, y: unit.position.y + 5 });
    updateUnit(world, unit, [unit]);
    expect(unit.moving).toBe(true);
    expect(unit.heading).toBeCloseTo(Math.PI / 2);
  });

  it("moves the revealed area along with the unit", () => {
    const world = openWorld();
    const unit = createUnit(world, "block", 0, 0, WHITE);
    queueWalk(unit, worldFromGrid(20, 0));
    runUntilIdle(world, unit);

    expect(unit.grid).toMatchObject({ x: 20, y: 0 });
    expect(world.isVisible(gridRef(20, 0))).toBe(true);
    expect(world.isVisible(gridRef(0, 0))).toBe(false);
    expect(world.isExplored(gridRef(0, 0))).toBe(true);
  });

  it("chains queued walks", () => {
    const world = openWorld();
    const unit = createUnit(world, "block", 0, 0, WHITE);
    const a = { x: unit.position.x + 2, y: unit.position.y };
    const b = { x: a.x, y: a.y + 2 };
    queueWalk(unit, a);
    queueWalk(unit, b);

    expect(unit.actions).toHaveLength(2);
    runUntilIdle(world, unit);
    expect(unit.position).toEqual(b);
  });

  it("walks around a building instead of through it", () => {
    const world = openWorld();
    const walker = createUnit(world, "block", 0, 0, WHITE);
    const mind = createUnit(world, "mind", 5, 0, WHITE);
    const target = worldFromGrid(10, 0);

    queueWalk(walker, target);
    walkChecking(world, walker, () => expect(world.isPassable(walker.grid)).toBe(true), [
      walker,
      mind,
    ]);
    expect(walker.position).toEqual(target);
  });

  it("re-plans when a building goes up on its route", () => {
    const world = openWorld();
    const walker = createUnit(world, "block", 0, 0, WHITE);
    const target = worldFromGrid(12, 0);
    queueWalk(walker, target);
    updateUnit(world, walker, [walker]); // plans a straight line

    wall(world, area([6, -3], [6, 3]));
    walkChecking(world, walker, () => expect(world.isPassable(walker.grid)).toBe(true));
    expect(walker.position).toEqual(target);
  });

  it("never climbs a cliff, even one it only discovers on the way", () => {
    // A 4 × 7 block of high ground in the way, with open ground all round it.
    const world = new World(
      terrain({ height: (x, y) => (x >= 5 && x < 9 && Math.abs(y - 0.5) < 4 ? 3 : 0) }),
    );
    const walker = createUnit(world, "block", 0, 0, WHITE);
    const target = worldFromGrid(12, 0);
    queueWalk(walker, target);

    let previous = walker.grid;
    walkChecking(world, walker, () => {
      expect(world.canClimb(previous, walker.grid)).toBe(true);
      previous = walker.grid;
    });
    expect(walker.grid).toMatchObject({ x: 12, y: 0 });
  });

  it("re-plans when it discovers acid across its route through the fog", () => {
    const world = worldWithAcid(area([8, -6], [8, 6])); // unseen wall of acid
    const walker = createUnit(world, "block", 0, 0, WHITE);
    const target = worldFromGrid(14, 0);
    queueWalk(walker, target);

    updateUnit(world, walker, [walker]);
    const first = walker.actions[0];
    expect(first?.kind === "walk" ? first.path : null).toEqual([target]); // straight through

    walkChecking(world, walker, () => expect(world.isPassable(walker.grid)).toBe(true));
    expect(walker.position).toEqual(target);
    expect(world.isExplored(gridRef(8, 0))).toBe(true);
  });

  it("keeps its route when what it discovers is off to the side", () => {
    const world = worldWithAcid(area([5, 1], [6, 2])); // a pond beside the route
    const walker = createUnit(world, "block", 0, 0, WHITE);
    queueWalk(walker, worldFromGrid(10, 0));

    updateUnit(world, walker, [walker]);
    const walk = walker.actions[0];
    if (walk?.kind !== "walk" || !walk.path) throw new Error("expected a planned walk");
    const route = walk.path;

    const before = world.knownObstaclesVersion;
    while (world.knownObstaclesVersion === before && walker.actions.length > 0) {
      updateUnit(world, walker, [walker]);
    }
    expect(world.knownObstaclesVersion).toBeGreaterThan(before); // the pond was seen
    updateUnit(world, walker, [walker]);

    expect(walk.path).toBe(route); // same plan, not re-planned
    expect(walk.plannedAt).toBe(world.knownObstaclesVersion);
  });

  it("lets two units walking head-on get past each other", () => {
    const world = openWorld();
    const a = createUnit(world, "block", 0, 0, WHITE);
    const b = createUnit(world, "block", 8, 0, WHITE);
    queueWalk(a, worldFromGrid(8, 0));
    queueWalk(b, worldFromGrid(0, 0));

    const ticks = runAll(world, [a, b]);

    expect(ticks).toBeLessThan(10_000);
    expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeGreaterThan(5);
  });

  it("stops near a destination another unit is standing on", () => {
    const world = openWorld();
    const walker = createUnit(world, "block", 0, 0, WHITE);
    const sitter = createUnit(world, "block", 6, 0, WHITE);
    queueWalk(walker, sitter.position);

    const ticks = runAll(world, [walker, sitter]);

    expect(ticks).toBeLessThan(10_000);
    expect(sitter.position).toEqual(worldFromGrid(6, 0));
    const gap = Math.hypot(
      walker.position.x - sitter.position.x,
      walker.position.y - sitter.position.y,
    );
    expect(gap).toBeLessThan(1.5);
  });
});

describe("unreachable targets", () => {
  it("gives up near the target instead of searching the whole map", () => {
    // The target sits on a plateau that runs on forever, ringed by cliffs.
    const world = new World(
      terrain({ height: (x, y) => (x >= 5 && Math.abs(y - 0.5) < 4 ? 3 : 0) }),
    );
    const walker = createUnit(world, "block", 0, 0, WHITE);
    queueWalk(walker, worldFromGrid(12, 0));

    const ticks = runUntilIdle(world, walker);
    expect(ticks).toBeLessThan(5000);
    expect(Math.abs(walker.position.x - 12)).toBeLessThan(40);
  });
});

describe("flying", () => {
  it("flies straight over acid, cliffs and buildings", () => {
    for (const world of [worldWithCliff(4), worldWithAcid(area([2, -2], [2, 2]))]) {
      const scout = createUnit(world, "scout", 0, 0, WHITE);
      createUnit(world, "mind", 6, 0, WHITE);
      explore(world, [5, 0], 10);
      const target = worldFromGrid(10, 0);
      queueWalk(scout, target);

      updateUnit(world, scout, [scout]);
      const walk = scout.actions[0];
      expect(walk?.kind === "walk" ? walk.path : null).toEqual([target]);
      runUntilIdle(world, scout);
      expect(scout.position).toEqual(target);
    }
  });

  it("doesn't bump into ground units below it", () => {
    const world = openWorld();
    const scout = createUnit(world, "scout", 0, 0, WHITE);
    const drone = createUnit(world, "block", 3, 0, WHITE);
    const target = worldFromGrid(6, 0);
    queueWalk(scout, target);

    const ticks = runUntilIdle(world, scout, [scout, drone]);
    expect(scout.position).toEqual(target);
    // Straight there: 6 tiles at 5 tiles per second is 72 ticks.
    expect(ticks).toBeLessThan(80);
  });
});

describe("gathering", () => {
  it("walks to the resource and mines it until it is gone", () => {
    const world = ironWorld();
    const unit = createUnit(world, "block", 0, 0, WHITE);
    const resource = world.resourceAt(gridRef(1, 0));
    if (!resource) throw new Error("expected iron next to the unit");
    resource.amount = 30;

    queueGather(unit, resource);
    runUntilIdle(world, unit);

    expect(unit.position).toEqual(resource.position);
    expect(unit.carrying.iron).toBe(30);
    expect(resource.exists).toBe(false);
  });
});

describe("cancelNextAction", () => {
  it("drops a walk together with the gather it leads to", () => {
    const world = ironWorld();
    const unit = createUnit(world, "block", 0, 0, WHITE);
    const resource = world.resourceAt(gridRef(1, 0));
    if (!resource) throw new Error("expected iron");

    queueGather(unit, resource);
    queueWalk(unit, { x: 0, y: 0 });
    cancelNextAction(unit);

    expect(unit.actions.map((a) => a.kind)).toEqual(["walk"]);
  });
});
