import { describe, expect, it } from "vitest";
import { WHITE } from "../src/game/colors";
import { TICK_RATE } from "../src/game/config";
import { gridRef } from "../src/game/coords";
import { MISSIONS, startMission, updateMission } from "../src/game/missions";
import { restore, serialize } from "../src/game/save";
import { createGame, type GameState, issueOrder, setSelection, tick } from "../src/game/state";

const player = { name: "Test", color: WHITE };

function run(state: GameState, seconds: number) {
  for (let i = 0; i < seconds * TICK_RATE; i++) {
    tick(state);
    updateMission(state);
  }
}

const explored = (state: GameState) =>
  state.world
    .generatedChunks()
    .reduce((n, chunk) => n + chunk.explored.reduce((a, b) => a + b, 0), 0);

describe("saving and loading", () => {
  it("carries a mission on where it left off", () => {
    const definition = MISSIONS.find((m) => m.id === "house-rules");
    if (!definition) throw new Error("no mission");
    const state = startMission(definition, player);
    run(state, 8);
    const drones = state.units.filter((u) => u.name === "block");
    setSelection(state, drones);
    issueOrder(state, { x: -10.5, y: 0.5 });
    run(state, 30);
    expect(state.mission?.current).toBe(1);

    // Through JSON, as it would be in storage.
    const data = JSON.parse(JSON.stringify(serialize(state)));
    const loaded = restore(data);

    expect(loaded.mission?.definition.id).toBe("house-rules");
    expect(loaded.mission?.current).toBe(1);
    expect(loaded.units.length).toBe(state.units.length);
    expect(loaded.economy).toEqual(state.economy);
    expect(explored(loaded)).toBeGreaterThanOrEqual(explored(state));
    expect(loaded.world.siteAt(gridRef(-11, 0))?.status).toBe("awake");
    const names = (s: GameState) =>
      s.units.map((u) => `${u.name}@${u.position.x.toFixed(2)},${u.position.y.toFixed(2)}`).sort();
    expect(names(loaded)).toEqual(names(state));

    // And it keeps going.
    run(loaded, 20);
    expect(loaded.mission?.outcome).toBeNull();
  });

  it("remembers what's been mined, and what drones were doing", () => {
    const state = createGame({ seed: "save", player });
    const drones = state.units.filter((u) => u.name === "block");
    const iron = state.world
      .generatedChunks()
      .flatMap((c) => c.resources)
      .filter((r) => r?.exists && state.world.isExplored(r.grid));
    const first = iron[0];
    if (!first) throw new Error("no bloom in sight");
    setSelection(state, drones);
    issueOrder(state, first.position, [first]);
    run(state, 10);
    const before = first.amount;

    const loaded = restore(JSON.parse(JSON.stringify(serialize(state))));
    expect(loaded.world.resourceAt(first.grid)?.amount).toBe(before);
    const busy = loaded.units.filter((u) => u.name === "block" && u.actions.length > 0);
    expect(busy.length).toBeGreaterThan(0);
  });
});
