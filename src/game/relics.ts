/**
 * What the Tessilend left, and what the Mind can make of it. Worker drones study a site by
 * standing around it; more drones study faster. Some sites need lattice to bring back to life.
 *
 * - Marker stones: an inscription. Quick to read.
 * - Archives: the builders' records. Each tells a little more of their story and marks the
 *   nearest sites the Mind hasn't found yet.
 * - Power taps: still connected to something deep down. Restored with lattice, they give power.
 * - Fabrication beds: hold the patterns for things the Mind can now build.
 * - Seedbeds: where lattice was grown. Once woken, their seams grow back after mining.
 * - Habitats: sealed, lit, and kept spotless by the Custody. For whom, nobody says.
 */

import { TICK_RATE } from "./config";
import { distance, gridRef, type Point } from "./coords";
import { findFreeSpots } from "./pathfinding";
import type { Site, SiteKind } from "./sites";
import { type GameState, say, workRate } from "./state";
import { cancelAllActions, queueWalk, type StudyAction, type Unit } from "./units";

export interface SiteInfo {
  label: string;
  /** What the player is told about it before and after it's studied. */
  dormant: string;
  awake: string;
  /** Drone-seconds of study it takes; two drones take half as long. */
  study: number;
  /** Lattice needed to bring it back to life once studied. */
  lattice: number;
  /** What the Mind says the first time it sees one. */
  sighted: string;
}

export const SITE_INFO: Record<SiteKind, SiteInfo> = {
  pod: {
    label: "Supply pod",
    dormant:
      "A Culture supply pod from the GSV Quiet Word In Your Ear. Unload it with worker drones.",
    awake: "Unloaded.",
    study: 60,
    lattice: 0,
    sighted:
      "There it is: a Culture supply pod, half buried and still ticking as it cools. Let's unload it before anyone else does.",
  },
  transmitter: {
    label: "Long-range transmitter",
    dormant:
      "A Tessilend transmitter, still aimed at something very far away. Study it with drones.",
    awake: "Restored. Charging it will be loud.",
    study: 24,
    lattice: 60,
    sighted:
      "A transmitter. Tessilend, long-range, and still aimed at somewhere a very long way off. If I can wake it, I can talk to home.",
  },
  marker: {
    label: "Marker stone",
    dormant: "An inscribed Tessilend stone. Send a worker drone to read it.",
    awake: "Read.",
    study: 6,
    lattice: 0,
    sighted: "A marker stone. The Tessilend labelled everything. I approve.",
  },
  archive: {
    label: "Tessilend archive",
    dormant: "The builders' records. Study it with worker drones.",
    awake: "Studied. It marked the nearest sites we hadn't found.",
    study: 20,
    lattice: 0,
    sighted:
      "Tessilend ruins, and not just pretty ones. That's an archive. Right-click it with worker drones and I'll read it.",
  },
  tap: {
    label: "Power tap",
    dormant: "A conduit to something deep below, still humming. Study it with drones.",
    awake: "Restored: +8 power, for as long as we like.",
    study: 12,
    lattice: 30,
    sighted:
      "That's a power tap, still connected to something very deep. If I can work out how it's meant to be fixed, it could run half the base.",
  },
  fabricator: {
    label: "Fabrication bed",
    dormant: "Where the builders made things. Study it to learn its patterns.",
    awake: "Studied. Its patterns are ours now.",
    study: 18,
    lattice: 0,
    sighted: "A fabrication bed. The patterns are still in it, if I can find the index.",
  },
  seedbed: {
    label: "Seedbed",
    dormant: "Where the builders grew their lattice. Study it with drones to wake it.",
    awake: "Awake: the lattice around it grows back after mining.",
    study: 12,
    lattice: 0,
    sighted:
      "A seedbed. This is where the Tessilend grew their lattice. It's asleep, not dead. I can tell the difference; most days.",
  },
  habitat: {
    label: "Habitat",
    dormant: "Sealed. Lit, aired and spotless, and the Custody won't let anyone in.",
    awake: "Open, and ready for its tenants.",
    study: 15,
    lattice: 0,
    sighted:
      "A habitat. Lights on, air fresh, floors swept. Nobody has lived here for ten thousand years. The staff are keeping house for someone.",
  },
};

/** Fragments of the Tessilend story, one per archive read, in order. */
export const ARCHIVE_LINES = [
  "The archive's index is nine thousand pages of maintenance schedules. Under 'Departure' it says only: 'Leave everything as it should be found.'",
  "A census. The Tessilend numbered eleven million when they left. Every one of them, on the same day.",
  "Planning records. They built twice as many homes as they ever lived in. The margin note says: 'For guests.'",
  "Instructions to the Custody: keep the houses, keep the gardens, keep the lights on. No end date given.",
  "A last entry, in a child's hand, as far as a Tessilend had hands: 'We'll leave the door open.'",
];

/** What generated marker stones say, chosen by where they stand. */
export const MARKER_LINES = [
  "'Terrace 41. Mind the step.' Ten thousand years, and the step is still there.",
  "'Water to the eastern gardens.' The gardens are rust now. The water still runs, somewhere.",
  "'Quiet hours apply.' I have been very quiet for some time.",
  "'Please return tools to the fabrication bed.' Somebody didn't.",
  "'This way to the archive.' No arrow. Presumably obvious, at the time.",
];

/** Lattice salvaged from a fabrication bed once we already have its patterns. */
const SALVAGE = 40;
/** Power a restored tap adds. */
export const TAP_POWER = 8;
/** Lattice a woken seedbed's seams grow back per seam, per second. */
const REGROW_PER_SECOND = 0.5;
/** How far a drone may stand from a site's edge and still study it. */
const STUDY_REACH = 1.7;

/** Give the drones in the selection a spot around the site each, and set them studying. */
export function orderStudy(
  state: GameState,
  workers: readonly Unit[],
  site: Site,
  queue: boolean,
): void {
  if (site.kind === "habitat" && site.status === "sealed") {
    // With proof that the habitats were built for guests, the staff will hear the Mind out.
    if (!state.flags.has("tenancy")) {
      say(state, SITE_INFO.habitat.dormant, "info");
      return;
    }
    site.status = "dormant";
  }
  if (site.status === "awake") {
    say(state, `${SITE_INFO[site.kind].label}: ${SITE_INFO[site.kind].awake}`);
    return;
  }
  const spots = findFreeSpots(state.world, site.center, workers.length);
  workers.forEach((unit, i) => {
    if (!queue) cancelAllActions(unit);
    const spot = spots[i] ?? site.center;
    queueWalk(unit, spot);
    unit.actions.push({ kind: "study", target: { ...spot }, site });
  });
}

function edgeDistance(site: Site, point: Point): number {
  const half = site.size / 2;
  const dx = Math.max(0, Math.abs(point.x - site.center.x) - half);
  const dy = Math.max(0, Math.abs(point.y - site.center.y) - half);
  return Math.hypot(dx, dy);
}

/** One tick of a drone studying a site. */
export function studyTick(state: GameState, unit: Unit, action: StudyAction): void {
  const { site } = action;
  const info = SITE_INFO[site.kind];
  if (site.status === "awake" || site.status === "sealed") {
    unit.actions.shift();
    return;
  }
  // Couldn't get close enough (blocked in): give up.
  if (edgeDistance(site, unit.position) > STUDY_REACH) {
    unit.actions.shift();
    return;
  }
  if (site.status === "awaiting") {
    payAndWake(state, site);
    unit.actions.shift();
    return;
  }
  site.status = "studying";
  site.progress += workRate(state) / TICK_RATE;
  if (site.progress >= info.study) {
    site.progress = info.study;
    if (info.lattice > 0) {
      site.status = "awaiting";
      payAndWake(state, site);
    } else {
      wake(state, site);
    }
  }
}

/** Spend the lattice a studied site needs, if we have it, and wake it. */
function payAndWake(state: GameState, site: Site): void {
  const cost = SITE_INFO[site.kind].lattice;
  if (state.economy.lattice >= cost) {
    state.economy.lattice -= cost;
    wake(state, site);
    return;
  }
  say(
    state,
    `I know how to fix the ${SITE_INFO[site.kind].label.toLowerCase()} now. It needs ${cost} lattice. Send drones back once we have it.`,
    "warning",
    { once: `needs-lattice-${site.id}-${Math.floor(state.ticks / (TICK_RATE * 20))}` },
  );
}

/** A site comes back to life. */
export function wake(state: GameState, site: Site): void {
  site.status = "awake";
  state.awake.push(site);
  state.stats.studied[site.kind] = (state.stats.studied[site.kind] ?? 0) + 1;
  switch (site.kind) {
    case "marker":
      say(
        state,
        site.text ?? MARKER_LINES[Math.abs(site.x * 7 + site.y * 13) % MARKER_LINES.length] ?? "",
        "success",
      );
      break;
    case "archive": {
      const read = (state.stats.studied.archive ?? 1) - 1;
      say(state, ARCHIVE_LINES[read % ARCHIVE_LINES.length] ?? "", "success");
      const marked = revealNearestSites(state, site, 2);
      if (marked > 0) {
        say(
          state,
          `It has a map, too. I've marked ${marked === 1 ? "another site" : `${marked} more sites`} we hadn't found.`,
        );
      }
      break;
    }
    case "tap":
      state.economy.power += TAP_POWER;
      say(
        state,
        `The tap's live: +${TAP_POWER} power. Ten thousand years and the meter's still running.`,
        "success",
      );
      break;
    case "fabricator":
      if (!state.designs.has("scout")) {
        state.designs.add("scout");
        say(
          state,
          "The fabrication bed had a pattern for a fast, light flier. I've adapted it. We can build scout drones now: bloom and a little lattice.",
          "success",
        );
      } else {
        const room = state.economy.storage.lattice - state.economy.lattice;
        const salvage = Math.max(0, Math.min(SALVAGE, room));
        state.economy.lattice += salvage;
        say(
          state,
          `Nothing new in this one's patterns, but it had ${salvage} lattice in its hoppers.`,
          "success",
        );
      }
      break;
    case "seedbed":
      say(state, "The seedbed's awake. Mined lattice here will grow back, slowly.", "success");
      break;
    case "habitat":
      state.flags.add("habitat-open");
      say(
        state,
        "The staff have read the records, checked them twice, and opened the doors. 'Guests,' they say. 'At last.'",
        "success",
      );
      break;
    case "pod": {
      const iron = Math.min(300, state.economy.storage.iron - state.economy.iron);
      const lattice = Math.min(100, state.economy.storage.lattice - state.economy.lattice);
      state.economy.iron += Math.max(0, iron);
      state.economy.lattice += Math.max(0, lattice);
      state.designs.add("scout");
      state.designs.add("decoy");
      state.flags.add("key");
      say(
        state,
        "Unloaded: bloom, lattice, drone patterns, habitat seed stock I can't imagine needing, and a sealed key I can't open. The GSV always did have a sense of humour.",
        "success",
      );
      break;
    }
    case "transmitter":
      state.flags.add("transmitter");
      say(
        state,
        "The transmitter's restored. Charging it will take a minute, and every Idiran on the planet will hear it humming. I'll wire in an uplink.",
        "success",
      );
      break;
  }
}

/** Explore a little around the nearest sites we haven't seen; returns how many were marked. */
function revealNearestSites(state: GameState, from: Site, count: number): number {
  const candidates = state.world
    .sitesNear(from.center, 90)
    .filter((site) => site !== from && !site.seen)
    .sort((a, b) => distance(a.center, from.center) - distance(b.center, from.center))
    .slice(0, count);
  for (const site of candidates) {
    const grid = gridRef(site.x, site.y);
    // Charted, not watched: the ground is explored but nobody's there to see it.
    state.world.watch(grid, Math.floor(site.size / 2) + 3);
    state.world.unwatch(grid, Math.floor(site.size / 2) + 3);
  }
  return candidates.length;
}

/** Notice sites the player's units come across, and keep woken seedbeds growing. */
export function relicsThink(state: GameState, seconds: number): void {
  for (const unit of state.units) {
    if (unit.faction !== "player") continue;
    for (const site of state.world.sitesNear(
      unit.position,
      unit.definition.communicationRadius + 4,
    )) {
      if (site.seen || !state.world.isExplored(gridRef(site.x, site.y))) continue;
      site.seen = true;
      state.discovered.add("lattice");
      say(state, SITE_INFO[site.kind].sighted, "info", { once: `sighted-site-${site.kind}` });
      if (site.seams.length > 0) {
        say(
          state,
          "The green crystals around it are lattice: what the Tessilend grew their works from. Drones can mine it, slowly. I suspect we'll want it.",
          "info",
          { once: "lattice-explained" },
        );
      }
    }
  }
  // Charted sites count as seen too, without the Mind remarking on each.
  for (const site of state.world.sitesNear(state.camera.target, 60)) {
    if (!site.seen && state.world.isExplored(gridRef(site.x, site.y))) site.seen = true;
  }

  for (const site of state.awake) {
    if (site.kind !== "seedbed") continue;
    for (const seam of site.seams) state.world.regrowSeam(seam, REGROW_PER_SECOND * seconds);
  }
}

export function siteStatusText(site: Site): string {
  const info = SITE_INFO[site.kind];
  switch (site.status) {
    case "dormant":
      return info.dormant;
    case "studying":
      return `Studying: ${Math.floor((site.progress / info.study) * 100)}%`;
    case "awaiting":
      return `Studied. Needs ${info.lattice} lattice to restore; send drones back once we have it.`;
    case "awake":
      return info.awake;
    case "sealed":
      return info.dormant;
  }
}
