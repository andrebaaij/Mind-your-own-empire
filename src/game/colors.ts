import type { Color } from "./units";

const DARK = 255;
const LIGHT = 180;

/** Untinted. */
export const WHITE: Color = { r: 255, g: 255, b: 255, a: 1 };

/** Tints applied to the player's units and buildings. */
export const PLAYER_COLORS = {
  white: WHITE,
  red: { r: DARK, g: LIGHT, b: LIGHT, a: 1 },
  green: { r: LIGHT, g: DARK, b: LIGHT, a: 1 },
  blue: { r: LIGHT, g: LIGHT, b: DARK, a: 1 },
  magenta: { r: DARK, g: LIGHT, b: DARK, a: 1 },
  cyan: { r: LIGHT, g: DARK, b: DARK, a: 1 },
  yellow: { r: DARK, g: DARK, b: LIGHT, a: 1 },
} as const satisfies Record<string, Color>;

export type PlayerColorName = keyof typeof PLAYER_COLORS;

export function playerColor(name: string | null): Color {
  return Object.hasOwn(PLAYER_COLORS, name ?? "") ? PLAYER_COLORS[name as PlayerColorName] : WHITE;
}

export function toCss(color: Color): string {
  return `rgb(${color.r} ${color.g} ${color.b} / ${color.a})`;
}
