// Distances are in tiles: one tile is one world unit, on the ground plane and in height.

/** Width/height of a chunk in tiles. Chunks are generated lazily as the camera reaches them. */
export const CHUNK_SIZE = 10;

/** Simulation ticks per second. Movement and gathering speeds are expressed per tick. */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
/** Cap on catch-up ticks per frame so a long stall (e.g. a background tab) can't freeze the game. */
export const MAX_TICKS_PER_FRAME = 5;

/** Camera pan speed in tiles per tick at the default zoom, and the multiplier while Shift is held. */
export const SCROLL_SPEED = 0.25;
export const SCROLL_SHIFT_MULTIPLIER = 3;
/** Camera rotation per tick while Q or E is held, in radians. */
export const ROTATE_SPEED = 0.03;
/** Camera distance from its target, in tiles. */
export const ZOOM_MIN = 6;
export const ZOOM_MAX = 60;
export const ZOOM_DEFAULT = 22;

/** Default movement speed in tiles per second, when an object doesn't set its own. */
export const DEFAULT_SPEED = 3;

/** Personal space of a mobile unit. Two units keep twice this apart. */
export const UNIT_RADIUS = 0.2;
/** Ticks a unit waits for a moving unit in its way before planning a route around it. */
export const BLOCKED_WAIT_TICKS = 20;
/** Re-plans a unit attempts after getting stuck before it gives up on the order. */
export const MAX_REPATHS = 3;
/** A blocked unit this close to its destination counts as arrived. */
export const ARRIVAL_RADIUS = 0.75;
/** A* search budget per path, in expanded tiles. */
export const MAX_PATH_NODES = 20_000;
/** Routes may stray at least this many tiles (or the trip length, if longer) from start and goal. */
export const MIN_DETOUR = 24;
/** New routes planned per tick; further units start their walk on the following ticks. */
export const PATHS_PER_TICK = 4;
/** Weight on the A* distance estimate; above 1 trades a little path length for speed. */
export const HEURISTIC_WEIGHT = 1.2;
/** Spacing of the samples used to check a straight walk for obstacles. */
export const LOS_SAMPLE_STEP = 0.25;

/** Steepest height change between neighbouring tiles that ground units can climb. */
export const MAX_CLIMB = 0.5;
/** Extra path cost per unit of height climbed, so routes prefer going around hills. */
export const CLIMB_COST = 2;
/** Largest height difference allowed across a building's footprint. */
export const MAX_BUILD_SLOPE = 0.6;

/** Iron a drone mines per second. */
export const GATHER_PER_SECOND = 2;
/** Iron the Mind starts with in free play. */
export const STARTING_IRON = 150;
/** How far a drone may be from the Mind and still hand over its load. */
export const DELIVERY_RANGE = 3.5;
/** Drone speed and mining rate while power runs short. */
export const BROWNOUT_FACTOR = 0.5;

/** A building with one of the player's mobile units this close counts as attended. */
export const ATTEND_RADIUS = 3.5;
/** Sensor spires keep buildings within this many tiles attended. */
export const SPIRE_ATTEND_RADIUS = 5;
/** Seconds a building must sit unattended under a warden's eye before it gets dismantled. */
export const INSPECT_SECONDS = 12;
/** Seconds a warden spends dismantling an unattended building. */
export const TIDY_SECONDS = 8;
/** How far a warden notices unattended buildings. */
export const WARDEN_SIGHT = 9;
