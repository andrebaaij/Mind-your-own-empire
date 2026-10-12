import { BUILDABLE, getObjectDefinition, type ObjectName } from "./definitions";
import type { MissionDefinition, MissionRuntime } from "./missions";
import type { GameState, Message } from "./state";
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

/** How long a message stays up: long enough to read, scaled by length. */
function readingTime(text: string): number {
  return Math.min(9000, Math.max(3500, text.length * 60));
}

export interface DialogAction {
  label: string;
  primary?: boolean;
  href?: string;
  onClick?: () => void;
}

/** The DOM overlay: resources, build bar, selection, objectives, the Mind's lines, dialogs. */
export class Hud {
  private readonly iron = byId("iron");
  private readonly ironStorage = byId("iron-storage");
  private readonly power = byId("energy");
  private readonly powerStatus = byId("power-status");
  private readonly message = byId<HTMLOutputElement>("message");
  private readonly messageSpeaker = byId("message-speaker");
  private readonly messageText = byId("message-text");
  private readonly pause = byId<HTMLDialogElement>("pause");
  private readonly selection = byId("selection");
  private readonly selectionList = byId("selection-list");
  private readonly objectives = byId("objectives");
  private readonly objectiveList = byId("objective-list");
  private readonly dialog = byId<HTMLDialogElement>("mission-dialog");
  private readonly buildButtons = new Map<ObjectName, HTMLButtonElement>();
  private readonly queue: Message[] = [];
  private messageUntil = 0;
  private speaker = "Only Visiting";
  private shownEconomy = "";
  private shownSelection = "";
  private shownObjectives = "";

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
      button.innerHTML = `
        <kbd>${index + 1}</kbd>
        <span class="build-name">${definition.label}</span>
        <span class="build-meta">
          <span>${icon("iron")}${format(definition.cost?.iron ?? 0)}</span>
          <span>${icon("energy")}${signed(definition.energy)}</span>
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
    // Mission dialogs must be answered with their buttons.
    this.dialog.addEventListener("cancel", (event) => event.preventDefault());
  }

  update(state: GameState): void {
    this.speaker = state.player.name;
    this.updateEconomy(state);
    this.updateSelection(state);
    if (state.mission) this.updateObjectives(state, state.mission);
    this.updateMessages(state);
  }

  private updateEconomy({ economy, building }: GameState): void {
    const key = `${economy.iron}|${economy.storage.iron}|${economy.power}|${building}`;
    if (key === this.shownEconomy) return;
    this.shownEconomy = key;

    this.iron.textContent = format(economy.iron);
    this.ironStorage.textContent = format(economy.storage.iron);
    this.power.textContent = signed(economy.power);
    this.power.classList.toggle("negative", economy.power < 0);
    this.powerStatus.textContent = economy.power < 0 ? "· brownout" : "";

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

  /** Completed objectives ticked off, the current one with its hint and progress. */
  private updateObjectives(state: GameState, runtime: MissionRuntime): void {
    const { definition } = runtime;
    const shown = definition.objectives.slice(0, runtime.current + 1);
    const rows = shown.map((objective, index) => ({
      text: objective.text,
      done: index < runtime.current,
      hint: index === runtime.current ? (objective.hint ?? "") : "",
      progress: index === runtime.current ? (objective.progress?.(state, runtime) ?? "") : "",
    }));
    const key = JSON.stringify(rows);
    if (key === this.shownObjectives) return;
    this.shownObjectives = key;

    this.objectives.hidden = false;
    byId("mission-act").textContent = `${definition.act} · Mission ${definition.number}`;
    byId("mission-title").textContent = definition.title;
    this.objectiveList.replaceChildren(
      ...rows.map((row) => {
        const item = document.createElement("li");
        item.className = row.done ? "done" : "active";
        const text = document.createElement("span");
        text.className = "objective-text";
        text.textContent = row.text;
        item.append(text);
        if (row.progress) {
          const progress = document.createElement("span");
          progress.className = "objective-progress";
          progress.textContent = row.progress;
          item.append(progress);
        }
        if (row.hint) {
          const hint = document.createElement("span");
          hint.className = "objective-hint";
          hint.textContent = row.hint;
          item.append(hint);
        }
        return item;
      }),
    );
  }

  /** Take the Mind's new lines from the game and show them one after another. */
  private updateMessages(state: GameState): void {
    this.queue.push(...state.messages.splice(0));
    const now = performance.now();
    if (now < this.messageUntil) return;
    const next = this.queue.shift();
    if (next) this.display(next);
    else if (!this.message.hidden && now >= this.messageUntil) this.message.hidden = true;
  }

  private display(message: Message): void {
    this.messageSpeaker.textContent = this.speaker;
    this.messageText.textContent = message.text;
    this.message.classList.toggle("warning", message.tone === "warning");
    this.message.classList.toggle("success", message.tone === "success");
    // Re-trigger the entrance animation for back-to-back messages.
    this.message.hidden = true;
    void this.message.offsetWidth;
    this.message.hidden = false;
    this.messageUntil = performance.now() + readingTime(message.text);
  }

  /** Show a message straight away, ahead of anything queued (for responses to the player). */
  showMessage(text: string, _durationMs?: number, tone: Message["tone"] = "info"): void {
    this.display({ text, tone });
  }

  setPaused(paused: boolean): void {
    if (paused && !this.pause.open) this.pause.showModal();
    if (!paused && this.pause.open) this.pause.close();
  }

  /** A mission dialog: briefing, victory or defeat. */
  showDialog(options: {
    kicker: string;
    title: string;
    paragraphs: string[];
    quote?: string;
    actions: DialogAction[];
  }): void {
    byId("mission-dialog-kicker").textContent = options.kicker;
    byId("mission-dialog-title").textContent = options.title;
    const body = byId("mission-dialog-body");
    body.replaceChildren(
      ...options.paragraphs.map((text) => {
        const p = document.createElement("p");
        p.textContent = text;
        return p;
      }),
    );
    if (options.quote) {
      const quote = document.createElement("blockquote");
      quote.textContent = options.quote;
      const cite = document.createElement("cite");
      cite.textContent = this.speaker;
      quote.append(cite);
      body.append(quote);
    }
    const actions = byId("mission-dialog-actions");
    actions.replaceChildren(
      ...options.actions.map((action) => {
        const element = document.createElement(action.href ? "a" : "button");
        element.className = `button${action.primary ? " primary" : ""}`;
        element.textContent = action.label;
        if (element instanceof HTMLAnchorElement && action.href) element.href = action.href;
        if (element instanceof HTMLButtonElement) element.type = "button";
        element.addEventListener("click", () => {
          if (action.onClick) {
            this.dialog.close();
            action.onClick();
          }
        });
        return element;
      }),
    );
    if (!this.dialog.open) this.dialog.showModal();
    (actions.querySelector(".primary") as HTMLElement | null)?.focus();
  }

  showBriefing(definition: MissionDefinition, onBegin: () => void): void {
    this.showDialog({
      kicker: `${definition.act} · Mission ${definition.number}`,
      title: definition.title,
      paragraphs: definition.briefing,
      actions: [
        { label: "Begin", primary: true, onClick: onBegin },
        { label: "Main menu", href: "./index.html" },
      ],
    });
  }
}
