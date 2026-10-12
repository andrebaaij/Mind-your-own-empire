import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { distance, gridRef } from "../src/game/coords";
import { isAttended } from "../src/game/custody";
import { SITE_INFO, TAP_POWER } from "../src/game/relics";
import { regionSiteSpec, SITE_CLEARANCE, type SiteSpec } from "../src/game/sites";
import {
  build,
  canBuild,
  createGame,
  type GameState,
  issueOrder,
  setSelection,
  spawn,
  tick,
} from "../src/game/state";
import { createNoise, noiseTerrain, START_CENTER, Terrain } from "../src/game/terrain";
import { createUnit } from "../src/game/units";
import { World } from "../src/game/world";
import { terrain } from "./fixtures";

const player = { name: "Test", color: WHITE };

/** A flat test world with hand-placed sites. */
function siteWorld(sites: SiteSpec[]): World {
  return new World(terrain(), sites);
}

function game(sites: SiteSpec[], layout: [string, number, number][] = []): GameState {
  const state = createGame({
    seed: "relics",
    player,
    sites,
    layout: [["mind", 5, 5], ...(layout as [never, number, number][])],
  });
  return state;
}

const seconds = (state: GameState, s: number) => {
  for (let i = 0; i < s * 60; i++) tick(state);
};

describe("site placement", () => {
  const ground = noiseTerrain(createNoise("placement"));
  const siteGround = {
    acid: (x: number, y: number) => ground.ground(x, y) === Terrain.Acid,
    height: (x: number, y: number) => ground.height(x + 0.5, y + 0.5),
  };

  it("is the same every time for a seed, and different for another", () => {
    const a = regionSiteSpec(2, -1, siteGround, 123);
    expect(regionSiteSpec(2, -1, siteGround, 123)).toEqual(a);
    const specs = Array.from({ length: 20 }, (_, i) => regionSiteSpec(i, 3, siteGround, 123));
    const others = Array.from({ length: 20 }, (_, i) => regionSiteSpec(i, 3, siteGround, 999));
    expect(specs).not.toEqual(others);
  });

  it("keeps clear of the crash site and off the acid", () => {
    const world = new World(ground);
    const sites = world.sitesNear(START_CENTER, 120);
    expect(sites.length).toBeGreaterThan(10);
    for (const site of sites) {
      expect(distance(site.center, START_CENTER)).toBeGreaterThanOrEqual(SITE_CLEARANCE - 1);
      for (const [x, y] of site.footprint) expect(ground.ground(x, y)).not.toBe(Terrain.Acid);
    }
  });

  it("stands on its footprint, with paving and lattice seams around it", () => {
    const world = siteWorld([{ kind: "tap", x: 30, y: 30 }]);
    const site = world.siteAt(gridRef(30, 30));
    expect(site?.kind).toBe("tap");
    expect(world.siteAt(gridRef(31, 29))).toBe(site);
    expect(world.isPassable(gridRef(30, 30))).toBe(false);
    expect(world.isPaved(gridRef(32, 30)) || world.isPaved(gridRef(30, 32))).toBe(true);
    expect(site?.seams.length).toBeGreaterThan(0);
    for (const seam of site?.seams ?? []) {
      world.watch(gridRef(seam.x, seam.y), 0);
      expect(world.resourceAt(gridRef(seam.x, seam.y))?.kind).toBe("lattice");
    }
  });

  it("isn't known to block routes until it has been seen", () => {
    const world = siteWorld([{ kind: "archive", x: 30, y: 30 }]);
    expect(world.isKnownPassable(gridRef(30, 30))).toBe(true);
    world.watch(gridRef(30, 30), 2);
    expect(world.isKnownPassable(gridRef(30, 30))).toBe(false);
  });
});

describe("studying sites", () => {
  function studyWith(state: GameState, drones: number, x: number, y: number) {
    const units = Array.from({ length: drones }, (_, i) => spawn(state, "block", x - 3, y + i - 1));
    state.world.watch(gridRef(x, y), 4);
    setSelection(state, units);
    issueOrder(state, { x: x + 0.5, y: y + 0.5 });
    return units;
  }

  it("reads an archive, faster with more drones, and marks other sites", () => {
    const state = game([
      { kind: "archive", x: 20, y: 5 },
      { kind: "seedbed", x: 45, y: 5 },
    ]);
    const drones = studyWith(state, 2, 20, 5);
    expect(drones[0]?.actions.at(-1)?.kind).toBe("study");
    seconds(state, 4 + SITE_INFO.archive.study / 2);
    const archive = state.world.siteAt(gridRef(20, 5));
    expect(archive?.status).toBe("awake");
    expect(state.stats.studied.archive).toBe(1);
    // The seedbed further east is now charted.
    expect(state.world.isExplored(gridRef(45, 5))).toBe(true);
  });

  it("restores a power tap only once it has the lattice", () => {
    const state = game([{ kind: "tap", x: 20, y: 5 }]);
    const power = state.economy.power;
    studyWith(state, 3, 20, 5);
    seconds(state, 4 + SITE_INFO.tap.study / 3 + 1);
    const tap = state.world.siteAt(gridRef(20, 5));
    expect(tap?.status).toBe("awaiting");
    expect(state.economy.power).toBe(power + 3 * -1);

    state.economy.lattice = 50;
    const drones = state.units.filter((u) => u.name === "block");
    setSelection(state, drones);
    issueOrder(state, { x: 20.5, y: 5.5 });
    seconds(state, 3);
    expect(tap?.status).toBe("awake");
    expect(state.economy.lattice).toBe(50 - SITE_INFO.tap.lattice);
    expect(state.economy.power).toBe(power - 3 + TAP_POWER);
  });

  it("learns the scout design from a fabrication bed", () => {
    const state = game([{ kind: "fabricator", x: 20, y: 5 }]);
    expect(canBuild(state, "scout")).toBe(false);
    studyWith(state, 3, 20, 5);
    seconds(state, 4 + SITE_INFO.fabricator.study / 3 + 1);
    expect(canBuild(state, "scout")).toBe(true);

    // Scouts cost lattice as well as iron.
    state.economy.iron = 500;
    state.world.watch(gridRef(8, 12), 3);
    expect(build(state, "scout", [gridRef(8, 12)]).shortOf).toBe("lattice");
    state.economy.lattice = 10;
    expect(build(state, "scout", [gridRef(8, 12)]).built).toBe(1);
    expect(state.economy.lattice).toBe(0);
  });

  it("won't let anyone into a habitat", () => {
    const state = game([{ kind: "habitat", x: 22, y: 5 }]);
    const drones = studyWith(state, 1, 22, 5);
    expect(drones[0]?.actions).toEqual([]);
    expect(state.world.siteAt(gridRef(22, 5))?.status).toBe("sealed");
  });
});

describe("lattice", () => {
  it("is mined, slower than iron, and stored at the Mind", () => {
    const state = game([{ kind: "seedbed", x: 16, y: 5 }]);
    const site = state.world.siteAt(gridRef(16, 5));
    const seam = site?.seams[0];
    if (!seam) throw new Error("no seam");
    state.world.watch(gridRef(seam.x, seam.y), 2);
    const drone = spawn(state, "block", seam.x - 1, seam.y);
    setSelection(state, [drone]);
    const resource = state.world.resourceAt(gridRef(seam.x, seam.y));
    expect(resource?.kind).toBe("lattice");
    issueOrder(state, resource?.position ?? { x: 0, y: 0 }, resource ? [resource] : []);
    seconds(state, 30);
    expect(state.economy.lattice).toBeGreaterThan(0);
    expect(state.stats.latticeDelivered).toBe(state.economy.lattice);
    expect(state.discovered.has("lattice")).toBe(true);
  });

  it("grows back around a woken seedbed", () => {
    const state = game([{ kind: "seedbed", x: 16, y: 5 }]);
    const site = state.world.siteAt(gridRef(16, 5));
    const seam = site?.seams[0];
    if (!site || !seam) throw new Error("no seam");
    state.world.watch(gridRef(seam.x, seam.y), 1);
    const resource = state.world.resourceAt(gridRef(seam.x, seam.y));
    if (!resource) throw new Error("no lattice");
    state.world.gather(resource, seam.amount);
    expect(state.world.resourceAt(gridRef(seam.x, seam.y))).toBeUndefined();

    site.status = "awake";
    state.awake.push(site);
    seconds(state, 120);
    expect(state.world.resourceAt(gridRef(seam.x, seam.y))?.amount).toBeGreaterThan(30);
  });
});

describe("Tessilend foundations", () => {
  it("make a building count as built to plan, so wardens leave it alone", () => {
    const state = game([{ kind: "archive", x: 20, y: 5 }]);
    const site = state.world.siteAt(gridRef(20, 5));
    const paved = site?.paving[0];
    if (!paved) throw new Error("no paving");
    state.world.watch(gridRef(paved[0], paved[1]), 1);
    state.economy.iron = 500;
    build(state, "solar", [gridRef(paved[0], paved[1])]);
    const onPlan = state.units.find((u) => u.name === "solar");
    if (!onPlan) throw new Error("not built");
    expect(isAttended(state, onPlan)).toBe(true);

    const elsewhere = createUnit(state.world, "solar", 40, 40, WHITE);
    expect(isAttended(state, elsewhere)).toBe(false);
  });
});
