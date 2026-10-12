import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { TICK_RATE } from "../src/game/config";
import { gridRef } from "../src/game/coords";
import { isUnlocked, MISSIONS, startMission, updateMission } from "../src/game/missions";
import { build, type GameState, issueOrder, setSelection, tick } from "../src/game/state";
import { setSilent } from "../src/game/stealth";

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

describe("mission 4: Ah. Company.", () => {
  it("is lost if the Mind just sits there", () => {
    const state = startMission(mission("ah-company"), player);
    run(state, 600);
    expect(state.mission?.outcome?.won).toBe(false);
    expect(state.suspicion).toBe(100);
  });

  it("can be won by running silent and leading the skimmers off with decoys", () => {
    const state = startMission(mission("ah-company"), player);
    setSilent(state, true);
    const scout = state.units.filter((u) => u.name === "scout");
    const spots = [
      [24, -10],
      [20, -18],
      [30, -2],
      [14, -20],
      [28, -14],
    ];
    for (let round = 0; round < 12 && !state.mission?.outcome; round++) {
      // Scout out a spot where the search is, plant a decoy there, and come home.
      const [x = 24, y = -10] = spots[round % spots.length] ?? [];
      setSelection(state, scout);
      issueOrder(state, { x: x + 0.5, y: y + 0.5 });
      run(state, 10);
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        if (build(state, "decoy", [gridRef(x + (dx ?? 0), y + (dy ?? 0))]).built) break;
      }
      setSelection(state, scout);
      issueOrder(state, { x: 6, y: 1 });
      run(state, 20);
    }
    expect(state.mission?.outcome?.won).toBe(true);
    expect(state.stats.decoysFound).toBeGreaterThan(0);
  });
});

describe("mission 5: Trespassers", () => {
  const CAMPS = [
    [-9, 24],
    [4, 27],
    [-3, 30],
  ];

  it("is lost if the camps are left to strip the seedbed", () => {
    const state = startMission(mission("trespassers"), player);
    run(state, 610);
    expect(state.mission?.outcome?.won).toBe(false);
  });

  it("can be won by luring each camp's guard away while a warden is near", () => {
    const state = startMission(mission("trespassers"), player);
    setSilent(state, true);
    for (const [cx = 0, cy = 0] of CAMPS) {
      const camp = state.units.find(
        (u) =>
          u.name === "camp" && Math.hypot(u.position.x - cx - 0.5, u.position.y - cy - 0.5) < 1,
      );
      if (!camp) throw new Error("no camp");
      for (let attempt = 0; attempt < 8 && state.units.includes(camp); attempt++) {
        // Wait for a warden to wander close, then lay a chain of two decoys leading away.
        for (let wait = 0; wait < 60; wait++) {
          const near = state.units.some(
            (u) =>
              u.faction === "custody" &&
              Math.hypot(u.position.x - camp.position.x, u.position.y - camp.position.y) < 6,
          );
          if (near) break;
          run(state, 1);
        }
        const dx = cx + 1.5;
        const dy = cy - 22.5;
        const length = Math.hypot(dx, dy);
        for (let k = 0; k < 2; k++) {
          const x = Math.round(cx + (dx / length) * (7 + k * 3.5));
          const y = Math.round(cy + (dy / length) * (7 + k * 3.5));
          // (Charted for the test; in play the scout finds the ground first.)
          state.world.watch(gridRef(x, y), 2);
          state.world.unwatch(gridRef(x, y), 2);
          for (const [ox, oy] of [
            [0, 0],
            [1, 0],
            [0, 1],
            [-1, 0],
          ]) {
            if (build(state, "decoy", [gridRef(x + (ox ?? 0), y + (oy ?? 0))]).built) break;
          }
        }
        run(state, 30);
      }
    }
    run(state, 5);
    expect(state.stats.evicted).toBe(3);
    expect(state.mission?.outcome?.won).toBe(true);
  });
});

describe("unlocking", () => {
  it("opens each mission once the one before is complete", () => {
    expect(isUnlocked(mission("arrived"), new Set())).toBe(true);
    expect(isUnlocked(mission("the-staff"), new Set())).toBe(false);
    expect(isUnlocked(mission("the-staff"), new Set(["arrived"]))).toBe(true);
  });
});
