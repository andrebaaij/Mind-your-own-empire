import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { TICK_RATE } from "../src/game/config";
import { gridRef } from "../src/game/coords";
import { inGrove } from "../src/game/cover";
import { createGame, type GameState, spawn, tick, workRate } from "../src/game/state";
import { arriveSkimmer, SENSOR_RADIUS, setSilent, signal, signature } from "../src/game/stealth";

const player = { name: "Test", color: WHITE };

function game(): GameState {
  return createGame({ seed: "stealth", player, layout: [["mind", 5, 5]] });
}

const run = (state: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_RATE; i++) tick(state);
};

describe("signatures", () => {
  it("make the Mind loudest and idle drones quietest", () => {
    const state = game();
    const mind = state.units[0];
    const drone = spawn(state, "block", 9, 9);
    const solar = spawn(state, "solar", 12, 12);
    if (!mind) throw new Error("no mind");
    expect(signature(state, mind)).toBeGreaterThan(signature(state, solar));
    expect(signature(state, solar)).toBeGreaterThan(signature(state, drone));
  });

  it("drop to about a third when running silent, which also halves the work rate", () => {
    const state = game();
    const mind = state.units[0];
    if (!mind) throw new Error("no mind");
    const loud = signature(state, mind);
    setSilent(state, true);
    expect(signature(state, mind)).toBeCloseTo(loud * 0.35);
    expect(workRate(state)).toBe(0.5);
  });

  it("fade with distance and vanish beyond sensor range", () => {
    const state = game();
    const mind = state.units[0];
    if (!mind) throw new Error("no mind");
    const near = signal(state, mind, { x: mind.position.x + 1, y: mind.position.y });
    const far = signal(state, mind, { x: mind.position.x + 5, y: mind.position.y });
    expect(near).toBeGreaterThan(far);
    expect(
      signal(state, mind, { x: mind.position.x + SENSOR_RADIUS + 1, y: mind.position.y }),
    ).toBe(0);
  });

  it("are smaller for drones hidden in a grove", () => {
    const state = game();
    // Find a grove tile and an open one.
    let grove: [number, number] | null = null;
    let open: [number, number] | null = null;
    for (let x = -60; x < 60 && (!grove || !open); x++) {
      for (let y = -60; y < 60 && (!grove || !open); y++) {
        if (inGrove(x + 0.5, y + 0.5)) grove ??= [x, y];
        else open ??= [x, y];
      }
    }
    if (!grove || !open) throw new Error("no grove found");
    const hidden = spawn(state, "block", grove[0], grove[1]);
    const exposed = spawn(state, "block", open[0], open[1]);
    expect(signature(state, hidden)).toBeLessThan(signature(state, exposed));
  });
});

describe("the Idiran search", () => {
  it("grows suspicious near the base and goes for a decoy instead when it hears one", () => {
    const state = game();
    state.search = { center: { x: 5.5, y: 5.5 }, radius: 3 };
    const skimmer = spawn(state, "skimmer", 8, 5, "idiran");
    arriveSkimmer(state, skimmer);
    run(state, 3);
    expect(state.suspicion).toBeGreaterThan(0);

    const before = state.suspicion;
    state.world.watch(gridRef(10, 5), 2);
    state.economy.iron = 500;
    state.designs.add("decoy");
    const decoy = spawn(state, "decoy", 10, 5);
    run(state, 15);
    expect(state.units.includes(decoy)).toBe(false);
    expect(state.stats.decoysFound).toBe(1);
    expect(state.suspicion).toBeLessThan(before + 15);
  });
});
