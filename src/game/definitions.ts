import type { ResourceKind } from "./world";

export type Skill = "walk" | "gather" | "scout";

/** Ground units path around obstacles; air units fly straight over them. */
export type Movement = "ground" | "air";

export interface ObjectDefinition {
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
  capacity?: Partial<Record<ResourceKind | "energy", number>>;
  storage: { iron: number; energy: number };
}

export interface ResourceDefinition {
  /** Thresholds for each visual level; an amount above `levels[n]` shows level `n`. */
  levels: number[];
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

export type ObjectName = "block" | "mind" | "scout" | "solar" | "tower";

/** Objects the player can build from the HUD. */
export const BUILDABLE: readonly ObjectName[] = ["solar", "block"];

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
