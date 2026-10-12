import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { TICK_RATE, TIDY_SECONDS } from "../src/game/config";
import { isAttended, setWardenHome } from "../src/game/custody";
import { createGame, type GameState, spawn, tick } from "../src/game/state";

/** A quiet base: the Mind, one drone parked beside it, and an outlying collector. */
function base(): GameState {
  return createGame({
    seed: "1500",
    player: { name: "Test", color: WHITE },
    layout: [
      ["mind", 5, 5],
      ["block", 4, 8],
      ["solar", 13, 5],
    ],
  });
}

const collector = (state: GameState) => state.units.find((u) => u.name === "solar");

function run(state: GameState, seconds: number) {
  for (let i = 0; i < seconds * TICK_RATE; i++) tick(state);
}

describe("attending", () => {
  it("counts the Mind, nearby drones and spire coverage", () => {
    const state = base();
    const solar = collector(state);
    const mind = state.units.find((u) => u.name === "mind");
    if (!solar || !mind) throw new Error("expected base");

    expect(isAttended(state, mind)).toBe(true);
    expect(isAttended(state, solar)).toBe(false);

    spawn(state, "tower", 13, 9); // four tiles away: inside spire coverage
    expect(isAttended(state, solar)).toBe(true);
  });
});

describe("wardens", () => {
  it("dismantle an unattended building", () => {
    const state = base();
    const warden = spawn(state, "warden", 18, 5, "custody");
    setWardenHome(warden, { x: 13.5, y: 5.5 });
    const powerBefore = state.economy.power;

    run(state, 30);

    expect(collector(state)).toBeUndefined();
    expect(state.stats.tidied).toBe(1);
    expect(state.economy.power).toBe(powerBefore - 3);
    expect(state.messages.some((m) => m.text.includes("Tidied away"))).toBe(true);
  });

  it("back off when a drone comes to stand by the building", () => {
    const state = base();
    const warden = spawn(state, "warden", 18, 5, "custody");
    setWardenHome(warden, { x: 13.5, y: 5.5 });
    const solar = collector(state);
    const drone = state.units.find((u) => u.name === "block");
    if (!solar || !drone) throw new Error("expected base");

    // Wait until the warden has started dismantling, then send the drone over.
    let ticks = 0;
    while ((solar.dismantling ?? 0) === 0 && ticks++ < TICK_RATE * 30) tick(state);
    expect(solar.dismantling).toBeGreaterThan(0);
    drone.position = { x: solar.position.x - 1.5, y: solar.position.y };

    run(state, TIDY_SECONDS + 2);
    expect(collector(state)).toBe(solar);
    expect(solar.dismantling).toBe(0);
  });

  it("never touch the Mind or a sensor spire", () => {
    const state = createGame({
      seed: "1500",
      player: { name: "Test", color: WHITE },
      layout: [
        ["mind", 5, 5],
        ["tower", 14, 5],
      ],
    });
    spawn(state, "warden", 9, 5, "custody");
    run(state, 40);
    expect(state.units.some((u) => u.name === "mind")).toBe(true);
    expect(state.units.some((u) => u.name === "tower")).toBe(true);
  });

  it("don't reveal the map to the player", () => {
    const state = base();
    spawn(state, "warden", 40, 40, "custody");
    expect(state.world.isExplored({ x: 40, y: 40, chunkX: 4, chunkY: 4, i: 0 })).toBe(false);
  });
});
