import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { TICK_RATE } from "../src/game/config";
import { gridRef } from "../src/game/coords";
import { isUnlocked, MISSIONS, startMission, updateMission } from "../src/game/missions";
import { build, type GameState, issueOrder, setSelection, tick } from "../src/game/state";

const player = { name: "Test", color: WHITE };

function run(state: GameState, seconds: number) {
  for (let i = 0; i < seconds * TICK_RATE; i++) {
    tick(state);
    updateMission(state);
    if (state.mission?.outcome) return;
  }
}

function mission(id: string) {
  const definition = MISSIONS.find((m) => m.id === id);
  if (!definition) throw new Error(`no mission ${id}`);
  return definition;
}

/** Send every drone to mine the nearest explored iron. */
function mineEverything(state: GameState) {
  const drones = state.units.filter((u) => u.faction === "player" && u.name === "block");
  setSelection(state, drones);
  const iron = state.world
    .getChunk(-1, 0)
    .resources.concat(state.world.getChunk(1, -1).resources)
    .filter((r) => r?.exists && state.world.isExplored(r.grid));
  const resources = iron.filter((r) => r !== undefined);
  if (resources.length === 0) throw new Error("no explored iron near the start");
  issueOrder(state, resources[0]?.position ?? { x: 0, y: 0 }, resources);
}

describe("mission 1: Arrived", () => {
  it("starts with iron to mine within sight of the Mind", () => {
    const state = startMission(mission("arrived"), player);
    expect(() => mineEverything(state)).not.toThrow();
  });

  it("can be won by mining, building drones, collectors and a spire", () => {
    const state = startMission(mission("arrived"), player);
    mineEverything(state);

    const place = (name: "block" | "solar" | "tower", x: number, y: number) =>
      build(state, name, [gridRef(x, y)]).built === 1;

    let spot = 0;
    const spots = [
      [8, 7],
      [9, 7],
      [7, 9],
      [8, 9],
      [9, 9],
      [10, 7],
      [10, 9],
      [7, 10],
      [9, 10],
    ];
    for (let minute = 0; minute < 15 && !state.mission?.outcome; minute++) {
      // A simple build order, as iron allows.
      for (let attempt = 0; attempt < 4; attempt++) {
        const drones = state.units.filter((u) => u.name === "block").length;
        const [x = 8, y = 8] = spots[spot % spots.length] ?? [];
        let ok = false;
        if (state.economy.power < 1) ok = place("solar", x, y);
        else if (!state.units.some((u) => u.name === "tower")) ok = place("tower", x, y);
        else if (drones < 8) ok = place("block", x, y);
        if (ok) spot++;
      }
      mineEverything(state);
      run(state, 60);
    }

    expect(state.mission?.outcome?.won).toBe(true);
    expect(state.mission?.current).toBe(mission("arrived").objectives.length);
  });
});

describe("mission 2: The Staff", () => {
  it("is lost if the wardens are left to tidy away the base", () => {
    const state = startMission(mission("the-staff"), player);
    run(state, 600);
    expect(state.mission?.outcome?.won).toBe(false);
    expect(state.stats.tidied).toBeGreaterThan(2);
  });

  it("brings the wardens in one at a time", () => {
    const state = startMission(mission("the-staff"), player);
    const wardens = () => state.units.filter((u) => u.faction === "custody").length;
    run(state, 12);
    expect(wardens()).toBe(1);
    run(state, 40);
    expect(wardens()).toBe(2);
  });
});

describe("unlocking", () => {
  it("opens each mission once the one before is complete", () => {
    expect(isUnlocked(mission("arrived"), new Set())).toBe(true);
    expect(isUnlocked(mission("the-staff"), new Set())).toBe(false);
    expect(isUnlocked(mission("the-staff"), new Set(["arrived"]))).toBe(true);
  });
});
