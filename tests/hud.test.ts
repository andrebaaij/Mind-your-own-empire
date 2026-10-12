import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { worldFromGrid } from "../src/game/coords";
import { summarizeSelection, unitStatus } from "../src/game/hud";
import { createUnit, queueWalk } from "../src/game/units";
import { openWorld } from "./fixtures";

describe("selection summary", () => {
  it("groups units by kind with what they are doing", () => {
    const world = openWorld();
    const a = createUnit(world, "block", 0, 0, WHITE);
    const b = createUnit(world, "block", 1, 0, WHITE);
    const scout = createUnit(world, "scout", 2, 0, WHITE);
    queueWalk(a, worldFromGrid(5, 5));
    b.carrying.iron = 40;

    expect(summarizeSelection([a, b, scout])).toEqual([
      { label: "Worker drone", count: 2, status: "1 moving, 1 idle · carrying 40 bloom" },
      { label: "Scout drone", count: 1, status: "Idle" },
    ]);
  });

  it("describes buildings as standing", () => {
    const world = openWorld();
    expect(unitStatus(createUnit(world, "solar", 0, 0, WHITE))).toBe("Standing");
  });
});
