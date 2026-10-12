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

describe("mission 2: reading the marker", () => {
  it("has a marker stone a drone can read", () => {
    const state = startMission(mission("the-staff"), player);
    const marker = state.world.siteAt(gridRef(4, -4));
    expect(marker?.kind).toBe("marker");
    const drone = state.units.find((u) => u.name === "block");
    if (!drone) throw new Error("no drone");
    state.world.watch(gridRef(4, -4), 2);
    setSelection(state, [drone]);
    issueOrder(state, marker?.center ?? { x: 0, y: 0 });
    run(state, 20);
    expect(marker?.status).toBe("awake");
    expect(state.stats.studied.marker).toBe(1);
  });
});

describe("mission 3: House Rules", () => {
  /** Drones of the player's, and the explored lattice around a site. */
  const drones = (state: GameState) =>
    state.units.filter((u) => u.faction === "player" && u.name === "block");
  const lattice = (state: GameState, x: number, y: number) =>
    (state.world.siteAt(gridRef(x, y))?.seams ?? [])
      .map((seam) => state.world.resourceAt(gridRef(seam.x, seam.y)))
      .filter((r) => r !== undefined);

  it("can be won: read the archive, mine lattice, restore the tap, build to plan, find the habitat", () => {
    const state = startMission(mission("house-rules"), player);
    const order = (
      units: ReturnType<typeof drones>,
      target: { x: number; y: number },
      resources = [] as ReturnType<typeof lattice>,
    ) => {
      setSelection(state, units);
      issueOrder(state, target, resources);
    };
    run(state, 8); // the archive is charted

    order(drones(state), { x: -10.5, y: 0.5 });
    run(state, 30);
    expect(state.mission?.current).toBe(1);

    const seams = lattice(state, -11, 0);
    expect(seams.length).toBeGreaterThan(0);
    order(drones(state), seams[0]?.position ?? { x: 0, y: 0 }, seams);
    for (let i = 0; i < 12 && (state.mission?.current ?? 0) < 2; i++) run(state, 10);
    expect(state.mission?.current).toBe(2);

    order(drones(state), { x: 8.5, y: -17.5 });
    for (let i = 0; i < 12 && (state.mission?.current ?? 0) < 3; i++) run(state, 10);
    expect(state.mission?.current).toBe(3);

    // Mine iron for three collectors, then build them on the archive's paving.
    const archive = state.world.siteAt(gridRef(-11, 0));
    const paving = archive?.paving ?? [];
    for (let i = 0; i < 20 && (state.mission?.current ?? 0) < 4; i++) {
      for (const [x, y] of paving) {
        if (state.economy.iron < 100) break;
        build(state, "solar", [gridRef(x, y)]);
      }
      mineEverything(state);
      run(state, 15);
    }
    expect(state.mission?.current).toBe(4);

    const scout = state.units.filter((u) => u.name === "scout");
    order(scout, { x: 36, y: -11 });
    run(state, 30);
    expect(state.mission?.outcome?.won).toBe(true);
    expect(state.stats.tidied).toBeLessThanOrEqual(3);
  });
});

describe("unlocking", () => {
  it("opens each mission once the one before is complete", () => {
    expect(isUnlocked(mission("arrived"), new Set())).toBe(true);
    expect(isUnlocked(mission("the-staff"), new Set())).toBe(false);
    expect(isUnlocked(mission("the-staff"), new Set(["arrived"]))).toBe(true);
  });
});
