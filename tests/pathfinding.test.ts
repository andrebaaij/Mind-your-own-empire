import { describe, expect, it } from "vitest";
import { gridFromWorld, gridRef, type Point, worldFromGrid } from "../src/game/coords";
import {
  assignSpots,
  findFreeSpots,
  findPath,
  findTilePath,
  hasClearLine,
  tileKey,
} from "../src/game/pathfinding";
import { World } from "../src/game/world";
import { area, explore, openWorld, terrain, wall, worldWithAcid, worldWithCliff } from "./fixtures";

const tiles = (path: { x: number; y: number }[]) => path.map((t) => [t.x, t.y]);

/** Every straight leg of the path stays on passable ground. */
function expectWalkable(world: World, from: Point, path: Point[]) {
  let previous = from;
  for (const point of path) {
    expect(hasClearLine(world, previous, point)).toBe(true);
    previous = point;
  }
}

describe("findTilePath", () => {
  it("goes straight across open ground", () => {
    const path = findTilePath(openWorld(), gridRef(0, 0), gridRef(4, 0));
    expect(tiles(path)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ]);
  });

  it("routes around a wall of buildings", () => {
    const world = openWorld();
    wall(world, area([3, -3], [3, 3]));
    const path = findTilePath(world, gridRef(0, 0), gridRef(6, 0));

    expect(path.at(-1)).toMatchObject({ x: 6, y: 0 });
    for (const tile of path) expect(world.isPassable(tile)).toBe(true);
  });

  it("routes around acid the player has seen", () => {
    const world = worldWithAcid(area([3, -3], [3, 3]));
    explore(world, [3, 0], 4);
    const path = findTilePath(world, gridRef(0, 0), gridRef(6, 0));

    expect(path.at(-1)).toMatchObject({ x: 6, y: 0 });
    for (const tile of path) expect(world.isPassable(tile)).toBe(true);
  });

  it("assumes unexplored ground is open, so the fog gives nothing away", () => {
    const world = worldWithAcid(area([3, -3], [3, 3]));
    const path = findTilePath(world, gridRef(0, 0), gridRef(6, 0));

    expect(tiles(path)).toContainEqual([3, 0]); // straight through the unseen acid
  });

  it("still knows about the player's own buildings in the fog", () => {
    const world = openWorld();
    wall(world, area([3, -3], [3, 3]));
    const path = findTilePath(world, gridRef(0, 0), gridRef(6, 0));

    for (const tile of path) expect(world.isPassable(tile)).toBe(true);
  });

  it("never squeezes diagonally between two blocked tiles", () => {
    const world = openWorld();
    // A closed diagonal wall: (1,0) and (0,1) block the diagonal step from (0,0) to (1,1).
    wall(world, [
      [1, 0],
      [0, 1],
    ]);
    const path = findTilePath(world, gridRef(0, 0), gridRef(1, 1));
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (!a || !b) continue;
      if (a.x !== b.x && a.y !== b.y) {
        expect(world.isPassable(gridRef(b.x, a.y))).toBe(true);
        expect(world.isPassable(gridRef(a.x, b.y))).toBe(true);
      }
    }
  });

  it("gets as close as it can when the goal is walled in", () => {
    const world = openWorld();
    // A ring of buildings around (10, 0).
    wall(
      world,
      area([8, -2], [12, 2]).filter(([x, y]) => Math.max(Math.abs(x - 10), Math.abs(y)) === 2),
    );
    const path = findTilePath(world, gridRef(0, 0), gridRef(10, 0), { maxNodes: 2000 });
    const end = path.at(-1);

    expect(end).toBeDefined();
    expect(world.isPassable(end ?? gridRef(0, 0))).toBe(true);
    // Ends right outside the ring, next to it.
    expect(Math.max(Math.abs((end?.x ?? 0) - 10), Math.abs(end?.y ?? 0))).toBe(3);
  });

  it("plans a long route quickly", () => {
    const world = openWorld();
    wall(world, area([50, -40], [50, 40]));
    const started = performance.now();
    const path = findTilePath(world, gridRef(0, 0), gridRef(100, 0));
    expect(path.at(-1)).toMatchObject({ x: 100, y: 0 });
    expect(performance.now() - started).toBeLessThan(250);
  });

  it("treats avoided tiles as blocked", () => {
    const path = findTilePath(openWorld(), gridRef(0, 0), gridRef(2, 0), {
      avoid: new Set([tileKey(1, 0)]),
    });
    expect(tiles(path)).not.toContainEqual([1, 0]);
    expect(path.at(-1)).toMatchObject({ x: 2, y: 0 });
  });
});

describe("height", () => {
  it("won't climb a cliff the player knows about, and stops at its foot", () => {
    const world = worldWithCliff(4); // a 3-tile drop along x = 4, as far as the eye can see
    explore(world, [4, 0], 90); // known well beyond where the search can reach
    const path = findTilePath(world, gridRef(0, 0), gridRef(8, 0), { maxNodes: 3000 });

    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (a && b) expect(world.canClimb(a, b)).toBe(true);
    }
    expect(path.at(-1)?.x).toBe(3);
  });

  it("takes the ramp up to a plateau", () => {
    // A plateau at x >= 4, with a gentle ramp at y = 6..8 and cliffs everywhere else.
    const world = new World(
      terrain({
        height: (x, y) => {
          if (x < 4) return 0;
          const onRamp = y >= 6 && y < 9;
          return onRamp ? Math.min(2, (x - 3.5) * 0.4) : 2;
        },
      }),
    );
    explore(world, [4, 4], 12);
    const path = findTilePath(world, gridRef(0, 0), gridRef(9, 0));

    expect(path.at(-1)).toMatchObject({ x: 9, y: 0 });
    expect(path.some((t) => t.x === 4 && t.y >= 6 && t.y < 9)).toBe(true);
  });

  it("climbs gentle slopes, preferring to go around a hill", () => {
    // A low hill centred on (5, 0); walking over it is allowed but costs more.
    const world = new World(
      terrain({ height: (x, y) => Math.max(0, 2 - Math.hypot(x - 5.5, y - 0.5) * 0.4) }),
    );
    explore(world, [5, 0], 10);
    const path = findTilePath(world, gridRef(0, 0), gridRef(10, 0));
    expect(path.at(-1)).toMatchObject({ x: 10, y: 0 });
    expect(tiles(path)).not.toContainEqual([5, 0]); // skirts the summit
  });

  it("plans straight across unexplored cliffs", () => {
    const world = worldWithCliff(4);
    const path = findTilePath(world, gridRef(0, 0), gridRef(8, 0));
    expect(tiles(path)).toContainEqual([4, 0]);
  });
});

describe("findPath", () => {
  it("walks straight to the exact point on open ground", () => {
    const from = worldFromGrid(0, 0);
    const to = { x: from.x + 9.4, y: from.y + 1.3 };
    expect(findPath(openWorld(), from, to)).toEqual([to]);
  });

  it("smooths the route around an obstacle into a few straight legs", () => {
    const world = openWorld();
    wall(world, area([3, -3], [3, 3]));
    const from = worldFromGrid(0, 0);
    const to = worldFromGrid(6, 0);
    const path = findPath(world, from, to);

    expect(path.at(-1)).toEqual(to);
    expect(path.length).toBeLessThanOrEqual(4);
    expectWalkable(world, from, path);
  });

  it("heads for the nearest open tile when the target is inside a building", () => {
    const world = openWorld();
    wall(world, area([4, -1], [6, 1]));
    const from = worldFromGrid(0, 0);
    const path = findPath(world, from, worldFromGrid(5, 0));
    const end = path.at(-1);
    if (!end) throw new Error("expected a path");

    expect(world.isPassable(gridFromWorld(end))).toBe(true);
    const tile = gridFromWorld(end);
    expect(Math.max(Math.abs(tile.x - 5), Math.abs(tile.y))).toBe(2);
  });

  it("returns no waypoints when the unit can't get any closer", () => {
    const world = openWorld();
    // Unit boxed in on its own tile.
    wall(
      world,
      area([-1, -1], [1, 1]).filter(([x, y]) => x !== 0 || y !== 0),
    );
    expect(findPath(world, worldFromGrid(0, 0), worldFromGrid(10, 0))).toEqual([]);
  });
});

describe("findFreeSpots", () => {
  it("starts at the clicked point and spreads over distinct nearby tiles", () => {
    const center = { ...worldFromGrid(0, 0), x: worldFromGrid(0, 0).x + 0.1 };
    const spots = findFreeSpots(openWorld(), center, 9);

    expect(spots[0]).toEqual(center);
    const keys = spots.map((p) => {
      const t = gridFromWorld(p);
      return tileKey(t.x, t.y);
    });
    expect(new Set(keys).size).toBe(9);
    for (const spot of spots) {
      expect(Math.hypot(spot.x - center.x, spot.y - center.y)).toBeLessThan(3);
    }
  });

  it("skips blocked tiles", () => {
    const world = openWorld();
    wall(world, area([-2, -2], [2, 2]));
    const spots = findFreeSpots(world, worldFromGrid(0, 0), 5);

    expect(spots).toHaveLength(5);
    for (const spot of spots) expect(world.isPassable(gridFromWorld(spot))).toBe(true);
  });
});

describe("assignSpots", () => {
  it("gives every mover its own spot, nearest first", () => {
    const movers = [
      { item: "left", from: { x: 0, y: 0 } },
      { item: "right", from: { x: 100, y: 0 } },
    ];
    const spots = [
      { x: 90, y: 0 },
      { x: 10, y: 0 },
    ];
    const assigned = assignSpots(movers, spots);
    expect(assigned.get("left")).toEqual({ x: 10, y: 0 });
    expect(assigned.get("right")).toEqual({ x: 90, y: 0 });
  });
});
