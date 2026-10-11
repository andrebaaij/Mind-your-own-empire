import type { ResourceKind } from "./world";

export type Direction = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/** Frame indices per direction for one animation. */
export type Animation = Record<Direction, number[]>;

export interface Box {
  lx: number;
  ty: number;
  rx: number;
  by: number;
}

export interface TilesetDefinition {
  /** Base name of the PNG in `src/assets/tilesets`. */
  image: string;
  /** When set, `<image>Selected.png` is shown while the object is selected. */
  imageSelected?: string;
  grid: { width: number; height: number };
  collisionBox?: Box;
  defaultAnimation?: string;
  animations?: Record<string, Animation>;
}

export type Skill = "walk" | "gather" | "scout";

export interface ObjectDefinition {
  skills: Partial<Record<Skill, boolean>>;
  communicationRadius: number;
  /** Net energy produced (positive) or consumed (negative). */
  energy: number;
  cost?: Partial<Record<ResourceKind, number>>;
  capacity?: Partial<Record<ResourceKind | "energy", number>>;
  storage: { iron: number; energy: number };
}

export interface ResourceDefinition {
  tileset: string;
  /** Thresholds for each visual level; an amount above `levels[n]` shows tile `n`. */
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

export const tilesets = byBasename(
  import.meta.glob<TilesetDefinition>("../assets/tilesets/*.json", {
    eager: true,
    import: "default",
  }),
);

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

export function getTileset(name: string): TilesetDefinition {
  const tileset = tilesets[name];
  if (!tileset) throw new Error(`Unknown tileset "${name}"`);
  return tileset;
}

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
