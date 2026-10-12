import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { gridRef, rectFromPoints, worldFromGrid } from "../src/game/coords";
import { getTileset } from "../src/game/definitions";
import {
  cancelNextAction,
  createUnit,
  directionOf,
  findUnits,
  footprintTiles,
  queueGather,
  queueWalk,
  type Unit,
  updateUnit,
} from "../src/game/units";
import type { World } from "../src/game/world";
import { acid, area, ironWorld, openWorld, wall } from "./fixtures";

const emptyWorld = openWorld;

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

describe("directionOf", () => {
  it("maps screen-space movement to compass directions", () => {
    expect(directionOf(0, -1)).toBe("N");
    expect(directionOf(1, 0)).toBe("E");
    expect(directionOf(-1, 1)).toBe("SW");
    expect(directionOf(1, -1)).toBe("NE");
  });
});

describe("footprintTiles", () => {
  it("covers a single tile for small buildings", () => {
    expect(footprintTiles(getTileset("solar"), 3, 4).map((t) => [t.x, t.y])).toEqual([[3, 4]]);
    expect(footprintTiles(getTileset("tower"), 3, 4)).toHaveLength(1);
  });

  it("covers the tiles under the Mind's base", () => {
    const tiles = footprintTiles(getTileset("mind"), 0, 0).map((t) => `${t.x},${t.y}`);
    expect(tiles).toContain("0,0");
    expect(tiles).toContain("1,1");
    expect(tiles).toContain("-1,-1");
    expect(tiles).not.toContain("3,0");
  });
});

describe("createUnit", () => {
  it("spawns at the centre of its tile and reveals its surroundings", () => {
    const world = emptyWorld();
    const unit = createUnit(world, "tower", 4, 2, WHITE);
    expect(unit.position).toEqual(worldFromGrid(4, 2));
    expect(world.isVisible(gridRef(4 + 3, 2 + 3))).toBe(true);
    expect(world.isVisible(gridRef(4 + 4, 2))).toBe(false);
  });
});

describe("walking", () => {
  it("arrives exactly at the target and then rests", () => {
    const world = emptyWorld();
    const unit = createUnit(world, "block", 0, 0, WHITE);
    const target = { x: unit.position.x + 101.3, y: unit.position.y - 47.9 };

    queueWalk(unit, target);
    const ticks = runUntilIdle(world, unit);

    expect(unit.position).toEqual(target);
    expect(ticks).toBeGreaterThan(40);
    expect(ticks).toBeLessThan(120);
    expect(unit.animation.name).toBe("walk");
    updateUnit(world, unit, [unit]);
    expect(unit.animation.name).toBe("rest");
  });

  it("moves the revealed area along with the unit", () => {
    const world = emptyWorld();
    const unit = createUnit(world, "scout", 0, 0, WHITE);
    queueWalk(unit, worldFromGrid(20, 0));
    runUntilIdle(world, unit);

    expect(unit.grid).toMatchObject({ x: 20, y: 0 });
    expect(world.isVisible(gridRef(20, 0))).toBe(true);
    expect(world.isVisible(gridRef(0, 0))).toBe(false);
    expect(world.isExplored(gridRef(0, 0))).toBe(true);
  });

  it("chains queued walks from the end of the previous one", () => {
    const world = emptyWorld();
    const unit = createUnit(world, "block", 0, 0, WHITE);
    const a = { x: unit.position.x + 50, y: unit.position.y };
    const b = { x: a.x, y: a.y + 50 };
    queueWalk(unit, a);
    queueWalk(unit, b);

    expect(unit.actions).toHaveLength(2);
    runUntilIdle(world, unit);
    expect(unit.position).toEqual(b);
  });

  it("walks around a building instead of through it", () => {
    const world = emptyWorld();
    const walker = createUnit(world, "block", 0, 0, WHITE);
    const mind = createUnit(world, "mind", 5, 0, WHITE);
    const target = worldFromGrid(10, 0);

    queueWalk(walker, target);
    let ticks = 0;
    while (walker.actions.length > 0 && ticks++ < 5000) {
      updateUnit(world, walker, [walker, mind]);
      expect(world.isPassable(walker.grid)).toBe(true);
    }
    expect(walker.position).toEqual(target);
  });

  it("re-plans when a building goes up on its route", () => {
    const world = emptyWorld();
    const walker = createUnit(world, "block", 0, 0, WHITE);
    const target = worldFromGrid(12, 0);
    queueWalk(walker, target);
    updateUnit(world, walker, [walker]); // plans a straight line

    wall(world, area([6, -3], [6, 3]));
    let ticks = 0;
    while (walker.actions.length > 0 && ticks++ < 5000) {
      updateUnit(world, walker, [walker]);
      expect(world.isPassable(walker.grid)).toBe(true);
    }
    expect(walker.position).toEqual(target);
  });

  it("re-plans when it discovers acid across its route through the fog", () => {
    const world = emptyWorld();
    acid(world, area([8, -6], [8, 6])); // unseen wall of acid
    const scout = createUnit(world, "scout", 0, 0, WHITE);
    const target = worldFromGrid(14, 0);
    queueWalk(scout, target);

    updateUnit(world, scout, [scout]);
    const firstPlan = scout.actions[0]?.kind === "walk" ? scout.actions[0].path : null;
    expect(firstPlan).toEqual([target]); // optimistic: straight through the fog

    let ticks = 0;
    while (scout.actions.length > 0 && ticks++ < 5000) {
      updateUnit(world, scout, [scout]);
      expect(world.isPassable(scout.grid)).toBe(true);
    }
    expect(scout.position).toEqual(target);
    expect(world.isExplored(gridRef(8, 0))).toBe(true);
  });

  it("keeps its route when what it discovers is off to the side", () => {
    const world = emptyWorld();
    acid(world, area([5, 3], [6, 4])); // a pond beside the route, within the scout's sight
    const scout = createUnit(world, "scout", 0, 0, WHITE);
    const target = worldFromGrid(10, 0);
    queueWalk(scout, target);

    updateUnit(world, scout, [scout]);
    const walk = scout.actions[0];
    if (walk?.kind !== "walk" || !walk.path) throw new Error("expected a planned walk");
    const route = walk.path;

    const versionBefore = world.knownObstaclesVersion;
    while (world.knownObstaclesVersion === versionBefore && scout.actions.length > 0) {
      updateUnit(world, scout, [scout]);
    }
    expect(world.knownObstaclesVersion).toBeGreaterThan(versionBefore); // the pond was seen
    updateUnit(world, scout, [scout]);

    expect(walk.path).toBe(route); // same plan, not re-planned
    expect(walk.plannedAt).toBe(world.knownObstaclesVersion);
  });

  it("lets two units walking head-on get past each other", () => {
    const world = emptyWorld();
    const a = createUnit(world, "block", 0, 0, WHITE);
    const b = createUnit(world, "block", 8, 0, WHITE);
    queueWalk(a, worldFromGrid(8, 0));
    queueWalk(b, worldFromGrid(0, 0));

    const ticks = runAll(world, [a, b]);

    expect(ticks).toBeLessThan(10_000);
    expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeGreaterThan(
      100,
    );
  });

  it("stops near a destination another unit is standing on", () => {
    const world = emptyWorld();
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
    expect(gap).toBeLessThan(80);
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

describe("findUnits", () => {
  it("picks units whose collision box is under a click", () => {
    const world = emptyWorld();
    const mind = createUnit(world, "mind", 5, 5, WHITE);
    const block = createUnit(world, "block", 0, 0, WHITE);
    const click = rectFromPoints(mind.position, mind.position);

    expect(findUnits([mind, block], click, true)).toEqual([mind]);
  });

  it("picks units whose position is inside a drag rectangle", () => {
    const world = emptyWorld();
    const a = createUnit(world, "block", 0, 0, WHITE);
    const b = createUnit(world, "block", 1, 0, WHITE);
    const c = createUnit(world, "block", 10, 10, WHITE);
    const rect = rectFromPoints({ x: 0, y: 0 }, { x: 100, y: 50 });

    expect(findUnits([a, b, c], rect, false)).toEqual([a, b]);
  });
});
