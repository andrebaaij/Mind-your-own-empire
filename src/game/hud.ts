import { BUILDABLE, getObjectDefinition, type ObjectName } from "./definitions";
import type { GameState } from "./state";
import type { Unit } from "./units";

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function format(n: number): string {
  return n.toLocaleString("en");
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${format(n)}`;
}

/** An SVG reference to one of the icon symbols defined in game.html. */
function icon(name: "iron" | "energy"): string {
  return `<svg class="icon ${name}" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
}

/** What a unit is doing, in a word or two. */
export function unitStatus(unit: Unit): string {
  if (!unit.definition.skills.walk) return "Standing";
  const action = unit.actions[0];
  if (!action) return "Idle";
  return action.kind === "walk" ? "Moving" : "Mining";
}

export interface SelectionRow {
  label: string;
  count: number;
  status: string;
}

/** Group the selection by kind, with a status line per group. */
export function summarizeSelection(units: readonly Unit[]): SelectionRow[] {
  const groups = new Map<string, Unit[]>();
  for (const unit of units) {
    const label = unit.definition.label;
    groups.set(label, [...(groups.get(label) ?? []), unit]);
  }

  return [...groups].map(([label, members]) => {
    const counts = new Map<string, number>();
    for (const unit of members) {
      const status = unitStatus(unit);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    let status =
      counts.size === 1
        ? ([...counts.keys()][0] ?? "")
        : [...counts].map(([s, n]) => `${n} ${s.toLowerCase()}`).join(", ");
    const carried = members.reduce((sum, unit) => sum + unit.carrying.iron, 0);
    if (carried > 0) status += ` · carrying ${format(carried)} iron`;
    return { label, count: members.length, status };
  });
}

/** The DOM overlay: resources, build bar, selection, toasts and the pause screen. */
export class Hud {
  private readonly iron = byId("iron");
  private readonly ironStorage = byId("iron-storage");
  private readonly energy = byId("energy");
  private readonly energyStorage = byId("energy-storage");
  private readonly message = byId<HTMLOutputElement>("message");
  private readonly pause = byId<HTMLDialogElement>("pause");
  private readonly selection = byId("selection");
  private readonly selectionList = byId("selection-list");
  private readonly buildButtons = new Map<ObjectName, HTMLButtonElement>();
  private messageTimer: number | undefined;
  private shownEconomy = "";
  private shownSelection = "";

  constructor(handlers: { onBuild: (name: ObjectName) => void; onResume: () => void }) {
    const items = byId("build-items");
    BUILDABLE.forEach((name, index) => {
      const definition = getObjectDefinition(name);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "build-item";
      button.dataset.build = name;
      button.title = definition.description;
      button.setAttribute("aria-pressed", "false");
      const energy = definition.energy;
      button.innerHTML = `
        <kbd>${index + 1}</kbd>
        <span class="build-name">${definition.label}</span>
        <span class="build-meta">
          <span>${icon("iron")}${format(definition.cost?.iron ?? 0)}</span>
          <span>${icon("energy")}${signed(energy)}/h</span>
        </span>`;
      button.addEventListener("click", () => handlers.onBuild(name));
      items.append(button);
      this.buildButtons.set(name, button);
    });

    byId("pause-continue").addEventListener("click", () => handlers.onResume());
    byId("pause-fullscreen").addEventListener("click", () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    });
    // Escape closes a modal <dialog> natively; treat that as resuming.
    this.pause.addEventListener("cancel", (event) => {
      event.preventDefault();
      handlers.onResume();
    });
  }

  update(state: GameState): void {
    this.updateEconomy(state);
    this.updateSelection(state);
  }

  private updateEconomy({ economy, building }: GameState): void {
    const key = `${economy.iron}|${economy.storage.iron}|${economy.energyPerHour}|${economy.storage.energy}|${building}`;
    if (key === this.shownEconomy) return;
    this.shownEconomy = key;

    this.iron.textContent = format(economy.iron);
    this.ironStorage.textContent = format(economy.storage.iron);
    this.energy.textContent = signed(economy.energyPerHour);
    this.energy.classList.toggle("negative", economy.energyPerHour < 0);
    this.energyStorage.textContent = format(economy.storage.energy);

    for (const [name, button] of this.buildButtons) {
      button.setAttribute("aria-pressed", String(name === building));
      const cost = getObjectDefinition(name).cost?.iron ?? 0;
      button.classList.toggle("unaffordable", economy.iron < cost);
    }
  }

  private updateSelection({ selection }: GameState): void {
    const rows = summarizeSelection(selection);
    const key = JSON.stringify(rows);
    if (key === this.shownSelection) return;
    this.shownSelection = key;

    this.selection.hidden = rows.length === 0;
    this.selectionList.replaceChildren(
      ...rows.map((row) => {
        const item = document.createElement("li");
        const count = document.createElement("span");
        count.className = "selection-count";
        count.textContent = `${row.count}×`;
        const name = document.createElement("span");
        name.className = "selection-name";
        name.textContent = row.label;
        const status = document.createElement("span");
        status.className = "selection-status";
        status.textContent = row.status;
        item.append(count, name, status);
        return item;
      }),
    );
  }

  showMessage(text: string, durationMs: number, tone: "info" | "warning" = "info"): void {
    this.message.textContent = text;
    this.message.classList.toggle("warning", tone === "warning");
    // Re-trigger the entrance animation for back-to-back messages.
    this.message.hidden = true;
    void this.message.offsetWidth;
    this.message.hidden = false;
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.message.hidden = true;
    }, durationMs);
  }

  setPaused(paused: boolean): void {
    if (paused && !this.pause.open) this.pause.showModal();
    if (!paused && this.pause.open) this.pause.close();
  }
}
