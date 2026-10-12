/** The codex as stored in the browser, shared by the game and the main menu. */

import { LORE_ORDER, type LoreEntry } from "./lore";

const KEY = "mind-your-own-empire:codex";

export function loadCodex(): LoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as LoreEntry[];
  } catch {
    return [];
  }
}

/** Add entries the player hasn't found before; returns the ones that were new. */
export function addToCodex(entries: readonly LoreEntry[]): LoreEntry[] {
  const codex = loadCodex();
  const known = new Set(codex.map((e) => e.id));
  const fresh = entries.filter((e) => !known.has(e.id));
  if (fresh.length === 0) return [];
  try {
    localStorage.setItem(KEY, JSON.stringify([...codex, ...fresh]));
  } catch {
    // Not remembered beyond this page.
  }
  return fresh;
}

/** Fill `container` with the codex, by category. */
export function renderCodex(container: HTMLElement): void {
  const codex = loadCodex();
  container.replaceChildren();
  if (codex.length === 0) {
    const empty = document.createElement("p");
    empty.className = "codex-empty";
    empty.textContent = "Nothing yet. The Mind writes down what it learns as it goes.";
    container.append(empty);
    return;
  }
  for (const category of LORE_ORDER) {
    const entries = codex.filter((e) => e.category === category);
    if (entries.length === 0) continue;
    const section = document.createElement("section");
    section.className = "codex-section";
    const heading = document.createElement("h2");
    heading.className = "label";
    heading.textContent = category;
    section.append(heading);
    for (const entry of entries) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = entry.title;
      const text = document.createElement("p");
      text.textContent = entry.text;
      details.append(summary, text);
      section.append(details);
    }
    container.append(section);
  }
}
