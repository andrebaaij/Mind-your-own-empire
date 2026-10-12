/**
 * Player settings, remembered in the browser: graphics quality, volumes, the Mind's voice, text
 * size and motion. Storage may be unavailable (private windows); then the defaults apply.
 */

export interface Settings {
  /** "auto" picks by GPU; changing it takes effect on the next load. */
  quality: "auto" | "high" | "low";
  master: number;
  ambience: number;
  effects: number;
  /** Whether the Mind speaks its lines aloud, and how loudly. */
  voice: boolean;
  voiceVolume: number;
  textSize: "normal" | "large";
  /** No camera shake or flourishes. */
  reducedMotion: boolean;
}

const KEY = "mind-your-own-empire:settings";

export const DEFAULT_SETTINGS: Settings = {
  quality: "auto",
  master: 1,
  ambience: 0.8,
  effects: 0.8,
  voice: false,
  voiceVolume: 0.9,
  textSize: "normal",
  reducedMotion: false,
};

export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not remembered, but still applied for this session.
  }
}
