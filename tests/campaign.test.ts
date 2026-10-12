/**
 * Acts II and III, played by simple bots: each mission can be won by doing the obvious thing
 * well, and (where it has a clock) lost by doing nothing.
 */
import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { TICK_RATE } from "../src/game/config";
import { gridRef, type Point } from "../src/game/coords";
import { MISSIONS, startMission, updateMission } from "../src/game/missions";
import { build, type GameState, issueOrder, setSelection, tick } from "../src/game/state";
import { setSilent } from "../src/game/stealth";
import type { Unit } from "../src/game/units";
import type { Resource } from "../src/game/world";

const player = { name: "Test", color: WHITE };

function mission(id: string) {
  const definition = MISSIONS.find((m) => m.id === id);
  if (!definition) throw new Error(`no mission ${id}`);
  return definition;
}

function run(state: GameState, seconds: number) {
  for (let i = 0; i < seconds * TICK_RATE; i++) {
    tick(state);
    updateMission(state);
    if (state.mission?.outcome) return;
  }
}

const drones = (state: GameState) =>
  state.units.filter((u) => u.faction === "player" && u.name === "block");
const scouts = (state: GameState) =>
  state.units.filter((u) => u.faction === "player" && u.name === "scout");

function order(state: GameState, units: Unit[], target: Point, resources: Resource[] = []) {
  setSelection(state, units);
  issueOrder(state, target, resources);
}

/** Explore a little ground, as the scout would. */
function chart(state: GameState, x: number, y: number, radius = 2) {
  state.world.watch(gridRef(x, y), radius);
  state.world.unwatch(gridRef(x, y), radius);
}

function decoyAt(state: GameState, x: number, y: number): boolean {
  chart(state, x, y);
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const) {
    if (build(state, "decoy", [gridRef(x + dx, y + dy)]).built) return true;
  }
  return false;
}

describe("mission 6: Post", () => {
  it("is lost if the Idirans reach the pod first", () => {
    const state = startMission(mission("post"), player);
    run(state, 200);
    expect(state.mission?.outcome?.won).toBe(false);
  });

  it("is won by unloading the pod quickly and slipping home", () => {
    const state = startMission(mission("post"), player);
    run(state, 3);
    order(state, drones(state), { x: 43.5, y: 34.5 });
    run(state, 25);
    decoyAt(state, 50, 33);
    decoyAt(state, 53, 36);
    for (let i = 0; i < 20 && (state.stats.studied.pod ?? 0) === 0; i++) run(state, 5);
    expect(state.flags.has("key")).toBe(true);
    setSilent(state, true);
    order(state, drones(state), { x: 5.5, y: 8.5 });
    run(state, 120);
    expect(state.mission?.outcome?.won).toBe(true);
  });
});

describe("mission 7: Relics", () => {
  it("is won by restoring the transmitter and keeping the skimmers busy while it charges", () => {
    const state = startMission(mission("relics"), player);
    run(state, 3);
    order(state, drones(state), { x: -20.5, y: -21.5 });
    run(state, 40);
    const seams = (state.world.siteAt(gridRef(-21, -22))?.seams ?? [])
      .map((seam) => {
        chart(state, seam.x, seam.y, 1);
        return state.world.resourceAt(gridRef(seam.x, seam.y));
      })
      .filter((r) => r !== undefined);
    order(state, drones(state), seams[0]?.position ?? { x: 0, y: 0 }, seams);
    for (let i = 0; i < 40 && state.economy.lattice < 60; i++) run(state, 5);
    order(state, drones(state), { x: -20.5, y: -21.5 });
    for (let i = 0; i < 10 && !state.flags.has("transmitter"); i++) run(state, 3);
    expect(state.flags.has("charging")).toBe(true);

    setSilent(state, true);
    order(state, drones(state), { x: 5.5, y: 8.5 });
    const spots = [
      [-31, -27],
      [-27, -14],
      [-16, -32],
      [-30, -20],
      [-22, -33],
      [-12, -27],
    ] as const;
    for (let i = 0; i < 12 && !state.mission?.outcome; i++) {
      const [x, y] = spots[i % spots.length] ?? [-31, -27];
      decoyAt(state, x, y);
      run(state, 8);
    }
    expect(state.mission?.outcome?.won).toBe(true);
  });
});

describe("mission 8: Sealed Orders", () => {
  it("is won by lighting three landing pads and surveying both habitats", () => {
    const state = startMission(mission("sealed-orders"), player);
    run(state, 2);
    let built = 0;
    for (const [x, y] of [
      [13, 13],
      [-2, 14],
      [15, -2],
      [16, 7],
    ] as const) {
      if (built >= 3) break;
      chart(state, x, y, 3);
      built += build(state, "pad", [gridRef(x, y)]).built;
    }
    setSilent(state, true);
    order(state, scouts(state), { x: 40.5, y: -5 });
    run(state, 25);
    order(state, scouts(state), { x: -18.5, y: -19 });
    run(state, 40);
    order(state, scouts(state), { x: 6, y: 1 });
    run(state, 30);
    expect(state.mission?.outcome?.won).toBe(true);
  });
});

describe("mission 9: Tenancy", () => {
  it("opens the habitat once the records prove it was built for guests", () => {
    const state = startMission(mission("tenancy"), player);
    const habitat = state.world.siteAt(gridRef(40, -11));
    // Before the proof, the staff won't let anyone in.
    state.world.watch(gridRef(40, -11), 3);
    order(state, drones(state), { x: 40.5, y: -10.5 });
    expect(habitat?.status).toBe("sealed");

    for (const [x, y] of [
      [16, -21],
      [-24, -5],
      [35, 17],
    ] as const) {
      order(state, drones(state), { x: x + 0.5, y: y + 0.5 });
      for (let i = 0; i < 20 && state.world.siteAt(gridRef(x, y))?.status !== "awake"; i++) {
        run(state, 3);
      }
    }
    order(state, drones(state), { x: 40.5, y: -10.5 });
    run(state, 60);
    expect(habitat?.status).toBe("awake");
    expect(state.mission?.outcome?.won).toBe(true);
  });
});

describe("mission 10: Only Visiting", () => {
  it("is lost if the raiders are left to wreck every pad", () => {
    const state = startMission(mission("only-visiting"), player);
    run(state, 300);
    expect(state.mission?.outcome?.won).toBe(false);
  });

  it("is won by luring raiders to the wardens and rebuilding pads", () => {
    const state = startMission(mission("only-visiting"), player);
    for (let i = 0; i < 40 && !state.mission?.outcome; i++) {
      if (state.units.filter((u) => u.name === "decoy").length < 2) {
        decoyAt(state, 17, 15);
        decoyAt(state, -3, 18);
      }
      if (state.units.filter((u) => u.name === "pad").length < 3) {
        for (const [x, y] of [
          [13, 11],
          [-1, 14],
          [14, -1],
        ] as const) {
          build(state, "pad", [gridRef(x, y)]);
        }
      }
      run(state, 10);
    }
    expect(state.stats.landed).toBe(8);
    expect(state.stats.escorted).toBeGreaterThan(0);
    expect(state.mission?.outcome?.won).toBe(true);
  });
});
