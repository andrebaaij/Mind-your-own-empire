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

/** Neutral players glow the pale cyan of a drone's aura field. */
export const NEUTRAL_GLOW = "#8fe8ff";

/**
 * The saturated, luminous version of a (pastel) player colour, as a CSS colour. Used for
 * aura fields and interface accents alike.
 */
export function glowCss(color: Color): string {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.05) return NEUTRAL_GLOW;

  let hue: number;
  if (max === r) hue = ((g - b) / (max - min) + 6) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  // Comma syntax: Three.js parses only that form.
  return `hsl(${Math.round(hue * 60)}, 80%, 62%)`;
}
