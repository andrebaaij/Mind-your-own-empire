/**
 * Tessilend sites: what the builders left standing. Each is a structure on a stone apron (their
 * foundations), ringed by seams of lattice, the crystal they grew their works from. Sites are
 * placed per region of the map from a hash, so a seed always has the same ones; missions can
 * place their own as well.
 *
 * This module only decides where sites are. What studying them does is in relics.ts.
 */

import { START_CENTER } from "./terrain";

export type SiteKind = "marker" | "archive" | "tap" | "fabricator" | "seedbed" | "habitat";

/** dormant → being studied → (waiting for lattice →) awake. Habitats stay sealed. */
export type SiteStatus = "dormant" | "studying" | "awaiting" | "awake" | "sealed";

export interface SiteSpec {
  kind: SiteKind;
  /** Centre tile. */
  x: number;
  y: number;
  /** What a marker stone says, for missions that want a particular inscription. */
  text?: string;
}

export interface Seam {
  x: number;
  y: number;
  /** Lattice in the seam when full. */
  amount: number;
}

export interface Site {
  id: number;
  kind: SiteKind;
  /** Centre tile, and its centre point on the ground. */
  x: number;
  y: number;
  center: { x: number; y: number };
  /** Side of the square the structure stands on, in tiles. */
  size: number;
  /** Tiles the structure stands on; nothing can walk through them. */
  footprint: [number, number][];
  /** Paved foundation tiles around it. */
  paving: [number, number][];
  seams: Seam[];
  text?: string;
  status: SiteStatus;
  /** Seconds of study done so far. */
  progress: number;
  /** Whether the player has seen it. */
  seen: boolean;
}

/** Sites are spread over square regions of this many tiles, at most one per region. */
export const REGION = 26;
/** No site is generated this close to the start: the crash site is the Mind's own. */
export const SITE_CLEARANCE = 18;

export const SITE_SIZE: Record<SiteKind, number> = {
  marker: 1,
  archive: 3,
  tap: 3,
  fabricator: 3,
  seedbed: 3,
  habitat: 5,
};

/** Width of the paved apron around each kind. */
const APRON: Record<SiteKind, number> = {
  marker: 1,
  archive: 2,
  tap: 2,
  fabricator: 2,
  seedbed: 1,
  habitat: 3,
};

/** How many lattice seams ring each kind, and how rich they are. */
const SEAMS: Record<SiteKind, [count: number, min: number, max: number]> = {
  marker: [0, 0, 0],
  archive: [3, 50, 110],
  tap: [5, 60, 130],
  fabricator: [4, 60, 120],
  seedbed: [11, 70, 150],
  habitat: [3, 60, 120],
};

/** How often each kind turns up in a region that has a site. */
const WEIGHTS: [SiteKind, number][] = [
  ["archive", 0.2],
  ["tap", 0.22],
  ["fabricator", 0.17],
  ["seedbed", 0.19],
  ["marker", 0.14],
  ["habitat", 0.08],
];

/** Chance that a region has a site at all. */
const SITE_CHANCE = 0.6;
/** Largest height difference allowed under a site and its apron. */
const MAX_SITE_SLOPE = 1.4;

/** A repeatable pseudo-random number in [0, 1). */
export function siteHash(x: number, y: number, salt: number): number {
  let h =
    Math.imul(x | 0, 2246822519) ^ Math.imul(y | 0, 3266489917) ^ Math.imul(salt | 0, 668265263);
  h = Math.imul(h ^ (h >>> 15), 2654435761);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** What site placement needs to know about the land. */
export interface SiteGround {
  /** Whether the tile is acid. */
  acid(x: number, y: number): boolean;
  /** Ground height at a tile's centre. */
  height(x: number, y: number): number;
}

let nextSiteId = 1;

/** Lay out a site of `kind` centred on tile (x, y): footprint, paving and seams. */
export function createSite(spec: SiteSpec, ground: SiteGround, salt: number): Site {
  const { kind, x, y } = spec;
  const size = SITE_SIZE[kind];
  const half = Math.floor(size / 2);
  const apron = APRON[kind];
  const footprint: [number, number][] = [];
  const paving: [number, number][] = [];
  for (let dy = -half - apron; dy <= half + apron; dy++) {
    for (let dx = -half - apron; dx <= half + apron; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (Math.abs(dx) <= half && Math.abs(dy) <= half) footprint.push([tx, ty]);
      // Ten thousand years have taken a few paving stones.
      else if (!ground.acid(tx, ty) && siteHash(tx, ty, salt + 7) < 0.86) paving.push([tx, ty]);
    }
  }

  const seams: Seam[] = [];
  const taken = new Set([...footprint, ...paving].map(([a, b]) => `${a},${b}`));
  const [count, min, max] = SEAMS[kind];
  const ring = half + apron + 1;
  for (let k = 0; k < count * 3 && seams.length < count; k++) {
    const r = (n: number) => siteHash(x * 31 + k, y * 17 - k, salt + n);
    const angle = r(1) * Math.PI * 2;
    const reach = ring + r(2) * (kind === "seedbed" ? 3 : 2.2);
    const sx = Math.round(x + Math.cos(angle) * reach);
    const sy = Math.round(y + Math.sin(angle) * reach);
    const key = `${sx},${sy}`;
    if (taken.has(key) || ground.acid(sx, sy)) continue;
    if (Math.abs(ground.height(sx, sy) - ground.height(x, y)) > 1.5) continue;
    taken.add(key);
    seams.push({ x: sx, y: sy, amount: Math.round(min + r(3) * (max - min)) });
  }

  return {
    id: nextSiteId++,
    kind,
    x,
    y,
    center: { x: x + 0.5, y: y + 0.5 },
    size,
    footprint,
    paving,
    seams,
    ...(spec.text ? { text: spec.text } : {}),
    status: kind === "habitat" ? "sealed" : "dormant",
    progress: 0,
    seen: false,
  };
}

/** Whether a site of `kind` fits at (x, y): no acid under it, and fairly level ground. */
function fits(kind: SiteKind, x: number, y: number, ground: SiteGround): boolean {
  const reach = Math.floor(SITE_SIZE[kind] / 2) + APRON[kind];
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (ground.acid(x + dx, y + dy)) return false;
      const h = ground.height(x + dx, y + dy);
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
  }
  return high - low <= MAX_SITE_SLOPE;
}

function pickKind(roll: number): SiteKind {
  let total = 0;
  for (const [kind, weight] of WEIGHTS) {
    total += weight;
    if (roll < total) return kind;
  }
  return "archive";
}

/**
 * The generated site in region (rx, ry), if there is one. Pure: the same inputs always give the
 * same site, so it doesn't matter which chunk asks first.
 */
export function regionSiteSpec(
  rx: number,
  ry: number,
  ground: SiteGround,
  salt: number,
): SiteSpec | null {
  const r = (n: number) => siteHash(rx, ry, salt + n);
  if (r(1) > SITE_CHANCE) return null;
  const kind = pickKind(r(2));
  const margin = Math.floor(SITE_SIZE[kind] / 2) + APRON[kind] + 3;
  // Try a few spots in the region; the land decides.
  for (let attempt = 0; attempt < 16; attempt++) {
    const x = rx * REGION + margin + Math.floor(r(10 + attempt) * (REGION - 2 * margin));
    const y = ry * REGION + margin + Math.floor(r(40 + attempt) * (REGION - 2 * margin));
    if (Math.hypot(x + 0.5 - START_CENTER.x, y + 0.5 - START_CENTER.y) < SITE_CLEARANCE) continue;
    if (fits(kind, x, y, ground)) return { kind, x, y };
  }
  return null;
}

/** The region a tile belongs to. */
export function regionOf(x: number, y: number): [number, number] {
  return [Math.floor(x / REGION), Math.floor(y / REGION)];
}
