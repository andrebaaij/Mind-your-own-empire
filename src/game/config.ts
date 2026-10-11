/** Size of one isometric tile in world pixels. */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/** Width/height of a chunk in tiles. Chunks are generated lazily as the camera reaches them. */
export const CHUNK_SIZE = 10;

/** Simulation ticks per second. Movement and gathering speeds are expressed per tick. */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
/** Cap on catch-up ticks per frame so a long stall (e.g. a background tab) can't freeze the game. */
export const MAX_TICKS_PER_FRAME = 5;

/** Camera scroll speed in world pixels per tick, and the multiplier while Shift is held. */
export const SCROLL_SPEED = 5;
export const SCROLL_SHIFT_MULTIPLIER = 3;

/** Distance a unit walks per tick, in world pixels. */
export const WALK_SPEED = 2;
/** Number of steps ahead a walking unit checks for obstacles. */
export const COLLISION_LOOKAHEAD = 50;
/** Iron gathered per tick while a unit is mining. */
export const GATHER_RATE = 1;

/** Drags shorter than this (in world pixels) count as a click. */
export const CLICK_TOLERANCE = 3;

/** Tile indices in the `tiles` tileset used for fog of war. */
export const FOG_EXPLORED_TILE = 48;

export const STARTING_IRON = 100_000;
