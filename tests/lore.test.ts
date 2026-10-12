import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { MISSIONS, startMission } from "../src/game/missions";
import { wake } from "../src/game/relics";
import { createGame, spawn } from "../src/game/state";
import { arriveSkimmer } from "../src/game/stealth";

const player = { name: "Test", color: WHITE };

describe("the codex", () => {
  it("learns the story as missions start", () => {
    const state = startMission(MISSIONS[0] ?? (undefined as never), player);
    expect(state.newLore.map((e) => e.id)).toContain("mission-arrived");
  });

  it("learns archive fragments in order, once each", () => {
    const state = createGame({
      seed: "lore",
      player,
      layout: [["mind", 5, 5]],
      sites: [
        { kind: "archive", x: 30, y: 30 },
        { kind: "archive", x: 60, y: 30 },
      ],
    });
    for (const [x, y] of [
      [30, 30],
      [60, 30],
    ] as const) {
      const site = state.world.sitesNear({ x, y }, 1)[0];
      if (site) wake(state, site);
    }
    const fragments = state.newLore.filter((e) => e.category === "The Tessilend");
    expect(fragments.map((e) => e.title)).toEqual(["Archive fragment 1", "Archive fragment 2"]);
  });

  it("learns about the Idirans when they arrive, and only once", () => {
    const state = createGame({ seed: "lore", player, layout: [["mind", 5, 5]] });
    arriveSkimmer(state, spawn(state, "skimmer", 20, 20, "idiran"));
    arriveSkimmer(state, spawn(state, "skimmer", 22, 20, "idiran"));
    expect(state.newLore.filter((e) => e.id === "idirans")).toHaveLength(1);
  });
});
