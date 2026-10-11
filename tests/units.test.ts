import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { WALK_SPEED } from "../src/game/config";
import { gridRef, rectFromPoints, worldFromGrid } from "../src/game/coords";
import {
  cancelNextAction,
  createUnit,
  findUnits,
  queueGather,
  queueWalk,
  stepTowards,
  type Unit,
  updateUnit,
} from "../src/game/units";
import { World } from "../src/game/world";

const emptyWorld = () => new World(() => -1);

function runUntilIdle(world: World, unit: Unit, others: Unit[] = [unit], maxTicks = 10_000) {
  let ticks = 0;
  while (unit.actions.length > 0 && ticks < maxTicks) {
    updateUnit(world, unit, others);
    ticks++;
  }
  return ticks;
}

describe("stepTowards", () => {
  it("moves WALK_SPEED pixels per tick towards the target", () => {
    const step = stepTowards({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(Math.hypot(step.x, step.y)).toBeCloseTo(WALK_SPEED);
    expect(step.x / step.y).toBeCloseTo(30 / 40);
  });

  it("does not move when already there", () => {
    expect(stepTowards({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
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

  it("steers around another unit in the way", () => {
    const world = emptyWorld();
    const walker = createUnit(world, "block", 0, 0, WHITE);
    const obstacle = createUnit(world, "mind", 0, 0, WHITE);
    obstacle.position = { x: walker.position.x + 150, y: walker.position.y };
    const target = { x: walker.position.x + 300, y: walker.position.y };

    queueWalk(walker, target);
    runUntilIdle(world, walker, [walker, obstacle]);

    expect(walker.position).toEqual(target);
  });
});

describe("gathering", () => {
  it("walks to the resource and mines it until it is gone", () => {
    const world = new World(() => 1); // iron everywhere
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
    const world = new World(() => 1);
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
