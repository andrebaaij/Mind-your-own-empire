import type { ResourceKind } from "./world";

export type Skill = "walk" | "gather" | "scout";

/** Ground units path around obstacles; air units fly straight over them. */
export type Movement = "ground" | "air";

export interface ObjectDefinition {
  /** Name shown in the interface. */
  label: string;
  /** One-line description for tooltips and the build bar. */
  description: string;
  skills: Partial<Record<Skill, boolean>>;
  /** How a mobile unit moves. Objects without the walk skill don't move. */
  movement?: Movement;
  /** Movement speed in tiles per second. */
  speed?: number;
  /** Size used for clicking on the object, in tiles. */
  radius: number;
  /** Hover height above the ground, in tiles. */
  altitude?: number;
  /** Side length in tiles of the square a building stands on. Buildings only. */
  footprint?: number;
  communicationRadius: number;
  /** Net energy produced (positive) or consumed (negative). */
  energy: number;
  cost?: Partial<Record<ResourceKind, number>>;
  /** `load`: how much a drone can carry, of any resources together. */
  capacity?: Partial<Record<"load" | "energy", number>>;
  storage: { iron: number; energy: number; lattice?: number };
}

export interface ResourceDefinition {
  /** Thresholds for each visual level; an amount above `levels[n]` shows level `n`. */
  levels: number[];
  /** Mining speed relative to iron. */
  rate?: number;
}

function byBasename<T>(modules: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(modules).map(([path, value]) => [
      path.replace(/^.*\//, "").replace(/\.\w+$/, ""),
      value,
    ]),
  );
}

export const objectDefinitions = byBasename(
  import.meta.glob<ObjectDefinition>("../data/objects/*.json", { eager: true, import: "default" }),
);

export const resourceDefinitions = byBasename(
  import.meta.glob<ResourceDefinition>("../data/resources/*.json", {
    eager: true,
    import: "default",
  }),
);

export type ObjectName =
  | "block"
  | "mind"
  | "scout"
  | "solar"
  | "tower"
  | "warden"
  | "skimmer"
  | "decoy"
  | "camp";

/** Who controls an object. */
export type Faction = "player" | "custody" | "idiran";

/** Objects the player can build from the HUD. */
export const BUILDABLE: readonly ObjectName[] = ["block", "solar", "tower", "scout", "decoy"];

export function getObjectDefinition(name: ObjectName): ObjectDefinition {
  const definition = objectDefinitions[name];
  if (!definition) throw new Error(`Unknown object "${name}"`);
  return definition;
}

export function getResourceDefinition(name: ResourceKind): ResourceDefinition {
  const definition = resourceDefinitions[name];
  if (!definition) throw new Error(`Unknown resource "${name}"`);
  return definition;
}
