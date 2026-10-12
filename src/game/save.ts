/**
 * Saving and loading a game, in the browser's storage. A save holds what can't be regenerated
 * from the seed: what the player has explored, what's been mined, the state of the Tessilend
 * sites, every unit and what it was doing, the economy, and the mission's progress.
 * Wildlife, effects and the wardens' passing thoughts start afresh.
 */

import alea from "alea";
import { gridFromWorld, gridRef, type Point } from "./coords";
import { setWardenHome, wardenPatrol } from "./custody";
import type { Faction, ObjectName } from "./definitions";
import { getMission, startMission } from "./missions";
import type { SiteStatus } from "./sites";
import {
  createGame,
  type Economy,
  type GameState,
  type Player,
  removeUnit,
  type Stats,
  spawn,
} from "./state";
import { arriveSkimmer, guardCamp, holdPost, raid, type Search, skimmerRole } from "./stealth";
import { type Action, newWalk, type Unit } from "./units";
import type { ResourceKind } from "./world";

const KEY = "mind-your-own-empire:save";
const VERSION = 1;

type SavedAction =
  | { kind: "walk"; x: number; y: number }
  | { kind: "gather"; x: number; y: number }
  | { kind: "deliver"; x: number; y: number }
  | { kind: "study"; x: number; y: number; site: [number, number] };

interface SavedUnit {
  name: ObjectName;
  faction: Faction;
  x: number;
  y: number;
  heading: number;
  carrying: Record<ResourceKind, number>;
  actions: SavedAction[];
  warden?: { home: Point; patrol: number };
  skimmer?: { guarding: number | null; post: Point | null; raiding: boolean };
}

export interface SaveData {
  version: number;
  savedAt: string;
  seed: string;
  missionId: string | null;
  player: Player;
  ticks: number;
  camera: GameState["camera"];
  economy: Economy;
  stats: Stats;
  flags: string[];
  designs: ObjectName[];
  discovered: string[];
  said: string[];
  silent: boolean;
  suspicion: number;
  search: Search | null;
  custodyTidying: boolean;
  custodyAllied: boolean;
  mission: {
    current: number;
    elapsed: number;
    fired: number[];
    counters: Record<string, number>;
  } | null;
  units: SavedUnit[];
  /** Explored chunks: which tiles are explored (base64), and the resources still in them. */
  chunks: { x: number; y: number; explored: string; resources: [number, number][] }[];
  sites: { x: number; y: number; status: SiteStatus; progress: number; seen: boolean }[];
}

function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function saveAction(action: Action): SavedAction | null {
  const { x, y } = action.target;
  switch (action.kind) {
    case "walk":
      return { kind: "walk", x, y };
    case "gather":
      return { kind: "gather", x: action.resource.position.x, y: action.resource.position.y };
    case "deliver":
      return { kind: "deliver", x, y };
    case "study":
      return { kind: "study", x, y, site: [action.site.x, action.site.y] };
    case "tidy":
      return null; // the warden will decide again
  }
}

/** Everything needed to carry on later, as plain data. */
export function serialize(state: GameState): SaveData {
  const index = new Map(state.units.map((unit, i) => [unit, i]));
  const units: SavedUnit[] = state.units.map((unit) => {
    const saved: SavedUnit = {
      name: unit.name,
      faction: unit.faction,
      x: unit.position.x,
      y: unit.position.y,
      heading: unit.heading,
      carrying: { ...unit.carrying },
      actions: unit.actions.map(saveAction).filter((a): a is SavedAction => a !== null),
    };
    if (unit.faction === "custody") saved.warden = wardenPatrol(unit);
    if (unit.faction === "idiran" && unit.definition.skills.walk) {
      const role = skimmerRole(unit);
      saved.skimmer = {
        guarding: role.guarding ? (index.get(role.guarding) ?? null) : null,
        post: role.post,
        raiding: role.raiding,
      };
    }
    return saved;
  });

  const chunks = state.world
    .generatedChunks()
    .filter((chunk) => chunk.explored.some((e) => e === 1))
    .map((chunk) => ({
      x: chunk.x,
      y: chunk.y,
      explored: toBase64(chunk.explored),
      resources: chunk.resources.flatMap((resource, i): [number, number][] =>
        resource?.exists ? [[i, resource.amount]] : [],
      ),
    }));

  const sites = state.world
    .knownSites()
    .filter((site) => site.seen || site.progress > 0 || site.status === "awake")
    .map((site) => ({
      x: site.x,
      y: site.y,
      status: site.status,
      progress: site.progress,
      seen: site.seen,
    }));

  const runtime = state.mission;
  return {
    version: VERSION,
    savedAt: new Date().toISOString(),
    seed: state.seed,
    missionId: runtime?.definition.id ?? null,
    player: state.player,
    ticks: state.ticks,
    camera: { ...state.camera, target: { ...state.camera.target } },
    economy: { ...state.economy, storage: { ...state.economy.storage } },
    stats: structuredClone(state.stats),
    flags: [...state.flags],
    designs: [...state.designs],
    discovered: [...state.discovered],
    said: [...state.said],
    silent: state.silent,
    suspicion: state.suspicion,
    search: state.search ? structuredClone(state.search) : null,
    custodyTidying: state.custodyTidying,
    custodyAllied: state.custodyAllied,
    mission: runtime
      ? {
          current: runtime.current,
          elapsed: runtime.elapsed,
          fired: [...runtime.fired],
          counters: { ...runtime.counters },
        }
      : null,
    units,
    chunks,
    sites,
  };
}

/** Rebuild a game from a save. */
export function restore(data: SaveData): GameState {
  const definition = data.missionId ? getMission(data.missionId) : undefined;
  const state = definition
    ? startMission(definition, data.player)
    : createGame({ seed: data.seed, player: data.player, layout: [] });
  // Clear what the mission set up; the save has the units as they were.
  for (const unit of [...state.units]) removeUnit(state, unit);
  state.events.length = 0;

  // The land as the player knew it.
  for (const saved of data.chunks) {
    const chunk = state.world.getChunk(saved.x, saved.y);
    chunk.explored.set(fromBase64(saved.explored));
    const remaining = new Map(saved.resources);
    chunk.resources.forEach((resource, i) => {
      if (!resource) return;
      const amount = remaining.get(i);
      if (amount === undefined) chunk.resources[i] = undefined;
      else state.world.gather(resource, resource.amount - amount);
    });
    chunk.version++;
  }
  for (const saved of data.sites) {
    const site = state.world.siteAt(gridRef(saved.x, saved.y));
    if (!site) continue;
    site.status = saved.status;
    site.progress = saved.progress;
    site.seen = saved.seen;
    if (saved.status === "awake") state.awake.push(site);
  }

  // Units, then what they were doing.
  const units: Unit[] = data.units.map((saved) => {
    const grid = gridFromWorld({ x: saved.x, y: saved.y });
    const unit = spawn(state, saved.name, grid.x, grid.y, saved.faction);
    unit.position = { x: saved.x, y: saved.y };
    unit.heading = saved.heading;
    unit.carrying = { ...saved.carrying };
    return unit;
  });
  data.units.forEach((saved, i) => {
    const unit = units[i];
    if (!unit) return;
    for (const action of saved.actions) {
      const target = { x: action.x, y: action.y };
      if (action.kind === "walk") unit.actions.push(newWalk(target));
      else if (action.kind === "deliver") unit.actions.push({ kind: "deliver", target });
      else if (action.kind === "gather") {
        const resource = state.world.resourceAt(gridFromWorld(target));
        if (resource) unit.actions.push({ kind: "gather", target, resource });
      } else {
        const site = state.world.siteAt(gridRef(action.site[0], action.site[1]));
        if (site) unit.actions.push({ kind: "study", target, site });
      }
    }
    if (saved.warden) setWardenHome(unit, saved.warden.home, saved.warden.patrol);
    if (saved.skimmer) {
      const camp = saved.skimmer.guarding !== null ? units[saved.skimmer.guarding] : undefined;
      if (camp) guardCamp(state, unit, camp);
      else if (saved.skimmer.post) holdPost(state, unit, saved.skimmer.post);
      else if (saved.skimmer.raiding) raid(state, unit);
      else arriveSkimmer(state, unit);
    }
  });

  // And everything else, exactly as it was (spawning units added to the economy).
  state.ticks = data.ticks;
  state.random = alea(`${data.seed}:resumed:${data.ticks}`);
  state.camera = { ...data.camera, target: { ...data.camera.target } };
  state.economy = { ...data.economy, storage: { ...data.economy.storage } };
  state.stats = structuredClone(data.stats);
  state.flags = new Set(data.flags);
  state.designs = new Set(data.designs);
  state.discovered = new Set(data.discovered);
  state.said = new Set(data.said);
  state.silent = data.silent;
  state.suspicion = data.suspicion;
  state.search = data.search ? structuredClone(data.search) : null;
  state.custodyTidying = data.custodyTidying;
  state.custodyAllied = data.custodyAllied;
  if (state.mission && data.mission) {
    state.mission.current = data.mission.current;
    state.mission.elapsed = data.mission.elapsed;
    state.mission.fired = new Set(data.mission.fired);
    state.mission.counters = { ...data.mission.counters };
  }
  state.events.length = 0;
  state.messages.length = 0;
  return state;
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(state)));
    return true;
  } catch {
    return false;
  }
}

/** The saved game, if there is one this version can read. */
export function loadSaved(): SaveData | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "null") as SaveData | null;
    return data?.version === VERSION ? data : null;
  } catch {
    return null;
  }
}
