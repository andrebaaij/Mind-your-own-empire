import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { STARTING_IRON, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from "../src/game/config";
import { gridFromWorld, gridRef, worldFromGrid } from "../src/game/coords";
import { getObjectDefinition } from "../src/game/definitions";
import {
  build,
  canPlace,
  createGame,
  issueOrder,
  moveCamera,
  noKeys,
  setSelection,
  spawn,
  tick,
  zoomCamera,
} from "../src/game/state";

const newGame = () => createGame({ seed: "1500", player: { name: "Test", color: WHITE } });

describe("createGame", () => {
  it("starts with the Mind, its helpers and a balanced energy budget", () => {
    const state = newGame();
    const counts = Object.groupBy(state.units, (u) => u.name);
    expect(counts.mind).toHaveLength(1);
    expect(counts.block).toHaveLength(3);
    expect(counts.solar).toHaveLength(6);
    expect(state.economy.iron).toBe(STARTING_IRON);
    expect(state.economy.energyPerHour).toBe(0);
    expect(state.economy.storage).toEqual({ iron: 20_000, energy: 2_000 });
  });
});

describe("build", () => {
  it("charges iron per building and stops when it runs out", () => {
    const state = newGame();
    const cost = getObjectDefinition("solar").cost?.iron ?? 0;
    state.economy.iron = cost * 2 + 1;
    const before = state.units.length;
    state.world.watch(gridRef(21, 20), 2);

    const result = build(state, "solar", [gridRef(20, 20), gridRef(21, 20), gridRef(22, 20)]);

    expect(result).toEqual({ built: 2, blocked: 0, outOfIron: true });
    expect(state.units.length).toBe(before + 2);
    expect(state.economy.iron).toBe(1);
    expect(state.economy.energyPerHour).toBe(4);
  });

  it("skips tiles that are unexplored or already built on", () => {
    const state = newGame();
    const mind = state.units.find((u) => u.name === "mind");
    if (!mind) throw new Error("expected the Mind");

    expect(canPlace(state, "solar", gridRef(5, 5))).toBe(false); // under the Mind
    expect(canPlace(state, "solar", gridRef(40, 40))).toBe(false); // unexplored
    expect(canPlace(state, "solar", gridRef(8, 8))).toBe(true);

    const result = build(state, "solar", [gridRef(5, 5), gridRef(8, 8), gridRef(40, 40)]);
    expect(result).toEqual({ built: 1, blocked: 2, outOfIron: false });
  });

  it("moves units off the ground a new building covers", () => {
    const state = newGame();
    const [block] = state.units.filter((u) => u.name === "block");
    if (!block) throw new Error("expected a block");

    build(state, "solar", [block.grid]);

    expect(block.actions.map((a) => a.kind)).toEqual(["walk"]);
    while (block.actions.length > 0) tick(state);
    expect(state.world.isPassable(block.grid)).toBe(true);
  });
});

describe("camera", () => {
  it("starts looking at the Mind from the old isometric angle", () => {
    const state = newGame();
    const mind = state.units.find((u) => u.name === "mind");
    expect(state.camera.target).toEqual(mind?.position);
    expect(state.camera.yaw).toBeCloseTo(Math.PI / 4);
  });

  it("pans relative to the way the camera faces", () => {
    const camera = { target: { x: 0, y: 0 }, yaw: 0, distance: ZOOM_DEFAULT };
    moveCamera(camera, { ...noKeys(), up: true });
    // Facing yaw 0 the camera looks towards -y, so "up" moves the target that way.
    expect(camera.target.x).toBeCloseTo(0);
    expect(camera.target.y).toBeLessThan(0);

    const turned = { target: { x: 0, y: 0 }, yaw: Math.PI / 2, distance: ZOOM_DEFAULT };
    moveCamera(turned, { ...noKeys(), up: true });
    expect(turned.target.x).toBeLessThan(0);
    expect(turned.target.y).toBeCloseTo(0);
  });

  it("pans faster with Shift and when zoomed out", () => {
    const pan = (distance: number, fast: boolean) => {
      const camera = { target: { x: 0, y: 0 }, yaw: 0, distance };
      moveCamera(camera, { ...noKeys(), right: true, fast });
      return camera.target.x;
    };
    expect(pan(ZOOM_DEFAULT, true)).toBeCloseTo(pan(ZOOM_DEFAULT, false) * 3);
    expect(pan(ZOOM_DEFAULT * 2, false)).toBeCloseTo(pan(ZOOM_DEFAULT, false) * 2);
  });

  it("rotates and clamps zoom", () => {
    const camera = { target: { x: 0, y: 0 }, yaw: 0, distance: ZOOM_DEFAULT };
    moveCamera(camera, { ...noKeys(), rotateRight: true });
    expect(camera.yaw).toBeGreaterThan(0);
    zoomCamera(camera, 100);
    expect(camera.distance).toBe(ZOOM_MAX);
    zoomCamera(camera, 0.0001);
    expect(camera.distance).toBe(ZOOM_MIN);
  });

  it("stays put while paused", () => {
    const state = newGame();
    const before = { ...state.camera.target };
    state.paused = true;
    state.keys.up = true;
    tick(state);
    expect(state.camera.target).toEqual(before);
  });
});

describe("orders", () => {
  it("walks the selection to a right-clicked spot", () => {
    const state = newGame();
    const blocks = state.units.filter((u) => u.name === "block");
    const [first] = blocks;
    if (!first) throw new Error("expected blocks");
    setSelection(state, blocks);
    expect(first.selected).toBe(true);

    const target = { x: first.position.x - 4, y: first.position.y };
    issueOrder(state, target);
    expect(blocks.every((b) => b.actions[0]?.kind === "walk")).toBe(true);

    setSelection(state, []);
    expect(first.selected).toBe(false);
  });

  it("orders gatherers to mine when right-clicking explored iron", () => {
    const state = newGame();
    const [block] = state.units.filter((u) => u.name === "block");
    const mind = state.units.find((u) => u.name === "mind");
    if (!block || !mind) throw new Error("expected starting units");
    setSelection(state, [block, mind]);

    // Iron never spawns right at the origin, so reveal the first iron tile further out.
    const resource = Array.from({ length: 20 }, (_, i) => state.world.getChunk(i, 0))
      .flatMap((chunk) => chunk.resources)
      .find((r) => r !== undefined);
    if (!resource) throw new Error("expected iron along the x axis");
    state.world.watch(resource.grid, 0);

    issueOrder(state, resource.position, [resource]);
    expect(block.actions.map((a) => a.kind)).toEqual(["walk", "gather"]);
    expect(mind.actions).toEqual([]);
  });

  it("replaces orders on a plain right-click and queues them with Shift", () => {
    const state = newGame();
    const [block] = state.units.filter((u) => u.name === "block");
    if (!block) throw new Error("expected a block");
    setSelection(state, [block]);

    const a = { x: block.position.x - 3, y: block.position.y + 1 };
    const b = { x: block.position.x - 6, y: block.position.y + 1 };
    issueOrder(state, a);
    issueOrder(state, b);
    expect(block.actions.map((x) => x.target)).toEqual([b]);

    issueOrder(state, a, [], true);
    expect(block.actions.map((x) => x.target)).toEqual([b, a]);
  });
});

describe("group movement", () => {
  it("spreads a group over separate spots that all get reached", () => {
    const state = newGame();
    const group = Array.from({ length: 12 }, (_, i) =>
      spawn(state, "block", -4 + (i % 4), 2 + Math.floor(i / 4)),
    );
    setSelection(state, group);

    // On the far side of the Mind.
    const target = { x: 10.5, y: 8.5 };
    issueOrder(state, target);

    const destinations = group.map((u) => u.actions[0]?.target);
    const tiles = new Set(
      destinations.map((d) => (d ? `${gridFromWorld(d).x},${gridFromWorld(d).y}` : "")),
    );
    expect(tiles.size).toBe(group.length);

    let ticks = 0;
    while (group.some((u) => u.actions.length > 0) && ticks++ < 3000) tick(state);
    expect(ticks).toBeLessThan(3000);

    // Nobody ended up inside a building, and the group didn't pile onto one point.
    for (const unit of group) expect(state.world.isPassable(unit.grid)).toBe(true);
    const arrived = group.filter((u, i) => {
      const d = destinations[i];
      return d && Math.hypot(u.position.x - d.x, u.position.y - d.y) < 1;
    });
    expect(arrived.length).toBeGreaterThanOrEqual(group.length - 2);
  });

  it("funnels a group through a gap in a wall", () => {
    const state = newGame();
    // A wall across x = 0..20 at grid y = 8 with a one-tile gap at x = 10.
    const wallTiles = Array.from({ length: 21 }, (_, x) => gridRef(x - 2, 8)).filter(
      (t) => t.x !== 8,
    );
    state.world.occupy(wallTiles, 1);
    const group = Array.from({ length: 6 }, (_, i) => spawn(state, "block", 12 + i, 7));
    setSelection(state, group);

    const target = worldFromGrid(8, 12);
    issueOrder(state, target);

    let ticks = 0;
    while (group.some((u) => u.actions.length > 0) && ticks++ < 5000) tick(state);

    expect(ticks).toBeLessThan(5000);
    for (const unit of group) {
      expect(state.world.isPassable(unit.grid)).toBe(true);
      expect(unit.grid.y).toBeGreaterThan(8); // made it through
    }
  });
});
