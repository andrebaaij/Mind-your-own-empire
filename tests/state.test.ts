import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { STARTING_IRON } from "../src/game/config";
import { gridRef, rectFromPoints } from "../src/game/coords";
import { getObjectDefinition } from "../src/game/definitions";
import {
  build,
  createGame,
  issueOrder,
  resourcesInRect,
  selectInRect,
  setSelection,
  tick,
} from "../src/game/state";
import { World } from "../src/game/world";

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

    const result = build(state, "solar", [gridRef(20, 20), gridRef(21, 20), gridRef(22, 20)]);

    expect(result).toEqual({ built: 2, outOfIron: true });
    expect(state.units.length).toBe(before + 2);
    expect(state.economy.iron).toBe(1);
    expect(state.economy.energyPerHour).toBe(4);
  });
});

describe("tick", () => {
  it("scrolls the camera while keeping the pointer fixed on screen", () => {
    const state = newGame();
    state.scroll.right = true;
    state.scroll.fast = true;
    tick(state);
    expect(state.camera).toEqual({ x: -15, y: 0 });
    expect(state.pointer.world).toEqual({ x: 15, y: 0 });
  });

  it("does nothing while paused", () => {
    const state = newGame();
    state.paused = true;
    state.scroll.up = true;
    tick(state);
    expect(state.camera).toEqual({ x: 0, y: 0 });
  });
});

describe("orders", () => {
  it("selects units by drag rectangle and walks them on right-click", () => {
    const state = newGame();
    const blocks = state.units.filter((u) => u.name === "block");
    const [first] = blocks;
    if (!first) throw new Error("expected blocks");

    // The three starting blocks sit in a row near the top of the map.
    const xs = blocks.map((b) => b.position.x);
    const ys = blocks.map((b) => b.position.y);
    selectInRect(
      state,
      rectFromPoints(
        { x: Math.min(...xs) - 1, y: Math.min(...ys) - 1 },
        { x: Math.max(...xs) + 1, y: Math.max(...ys) + 1 },
      ),
    );
    expect(state.selection.map((u) => u.name)).toEqual(["block", "block", "block"]);
    expect(first.selected).toBe(true);

    // Right-click somewhere without explored iron: everyone walks there.
    const target = { x: first.position.x, y: first.position.y - 200 };
    issueOrder(state, rectFromPoints(target, target), target);
    expect(blocks.every((b) => b.actions[0]?.kind === "walk")).toBe(true);

    setSelection(state, []);
    expect(first.selected).toBe(false);
  });

  it("finds only explored resources inside a drag rectangle", () => {
    const world = new World(() => 1); // iron on every tile
    world.watch(gridRef(0, 0), 1); // explore tiles -1..1

    // A screen-aligned strip through the centres of (0, 0), (1, -1) and (1, 0), running on
    // into unexplored ground at (2, -1) and beyond.
    const rect = rectFromPoints({ x: 20, y: 10 }, { x: 300, y: 40 });
    const found = resourcesInRect(world, rect).map((r) => [r.grid.x, r.grid.y]);

    expect(found).toEqual([
      [1, -1],
      [0, 0],
      [1, 0],
    ]);
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

    issueOrder(state, rectFromPoints(resource.position, resource.position), resource.position);
    expect(block.actions.map((a) => a.kind)).toEqual(["walk", "gather"]);
    expect(mind.actions).toEqual([]);
  });
});
