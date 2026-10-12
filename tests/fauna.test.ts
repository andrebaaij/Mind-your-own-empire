import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { distance, gridFromWorld, type Point } from "../src/game/coords";
import { Fauna, FLEE_RADIUS, type Grazer, type Herd } from "../src/game/fauna";
import { START_CENTER } from "../src/game/terrain";
import { createUnit } from "../src/game/units";
import { World } from "../src/game/world";
import { openWorld, terrain, worldWithAcid } from "./fixtures";

const FOCUS: Point = { x: 40, y: 40 };
const step = (fauna: Fauna, seconds: number, units = [] as Parameters<Fauna["update"]>[0]) => {
  for (let t = 0; t < seconds * 30; t++) fauna.update(units, FOCUS, 1 / 30);
};
const allGrazers = (fauna: Fauna): Grazer[] => fauna.herds.flatMap((herd: Herd) => herd.grazers);

describe("Fauna", () => {
  it("keeps herds, flocks and a longshank around the view", () => {
    const fauna = new Fauna(openWorld(), "test");
    step(fauna, 1);
    expect(fauna.herds.length).toBeGreaterThan(0);
    expect(fauna.flocks.length).toBeGreaterThan(0);
    expect(fauna.longshank).not.toBeNull();
    for (const herd of fauna.herds)
      expect(distance(Fauna.herdCenter(herd), FOCUS)).toBeLessThan(55);
  });

  it("is repeatable for the same seed", () => {
    const a = new Fauna(openWorld(), "same");
    const b = new Fauna(openWorld(), "same");
    step(a, 5);
    step(b, 5);
    expect(allGrazers(a).map((g) => g.position)).toEqual(allGrazers(b).map((g) => g.position));
  });

  it("never leaves wildlife in the base", () => {
    const fauna = new Fauna(openWorld(), "base");
    for (let t = 0; t < 20 * 30; t++) fauna.update([], START_CENTER, 1 / 30);
    for (const grazer of allGrazers(fauna)) {
      expect(distance(grazer.position, START_CENTER)).toBeGreaterThanOrEqual(12);
    }
  });

  it("never walks into acid", () => {
    // Acid everywhere except a wide square of dirt around the focus.
    const world = new World(
      terrain({
        ground: (x, y) => (Math.abs(x - 40) < 30 && Math.abs(y - 40) < 30 ? 0 : 2),
      }),
    );
    const fauna = new Fauna(world, "acid");
    step(fauna, 60);
    for (const grazer of allGrazers(fauna)) {
      expect(world.isPassable(gridFromWorld(grazer.position))).toBe(true);
    }
  });

  it("bolts away from a drone that comes too close", () => {
    const world = openWorld();
    const fauna = new Fauna(world, "flee");
    step(fauna, 1);
    const grazer = allGrazers(fauna)[0] as Grazer;
    const at = grazer.position;
    const drone = createUnit(world, "block", Math.floor(at.x + 1), Math.floor(at.y), WHITE);
    const before = distance(drone.position, grazer.position);
    expect(before).toBeLessThan(FLEE_RADIUS);
    step(fauna, 1.5, [drone]);
    expect(grazer.mood).toBe("flee");
    expect(distance(drone.position, grazer.position)).toBeGreaterThan(before + 1.5);
  });

  it("ignores buildings: only things that move are frightening", () => {
    const world = openWorld();
    const fauna = new Fauna(world, "calm");
    step(fauna, 1);
    const grazer = allGrazers(fauna)[0] as Grazer;
    const solar = createUnit(
      world,
      "solar",
      Math.floor(grazer.position.x) + 3,
      Math.floor(grazer.position.y),
      WHITE,
    );
    step(fauna, 0.2, [solar]);
    expect(grazer.mood).not.toBe("flee");
  });

  it("moves stragglers back near the view when the camera moves away", () => {
    const fauna = new Fauna(openWorld(), "follow");
    step(fauna, 1);
    const far = { x: 400, y: -300 };
    fauna.update([], far, 1 / 30);
    for (const herd of fauna.herds) expect(distance(Fauna.herdCenter(herd), far)).toBeLessThan(55);
    for (const flock of fauna.flocks) expect(distance(flock.center, far)).toBeLessThan(55);
  });

  it("does not let the longshank walk through the base", () => {
    const fauna = new Fauna(worldWithAcid([]), "giant");
    for (let t = 0; t < 120 * 10; t++) {
      fauna.update([], START_CENTER, 1 / 10);
      const strider = fauna.longshank;
      if (strider) expect(distance(strider.position, START_CENTER)).toBeGreaterThanOrEqual(21.9);
    }
  });
});
