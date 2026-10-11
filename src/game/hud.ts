import { BUILDABLE, type ObjectName } from "./definitions";
import type { Economy } from "./state";

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

/** The DOM overlay: resource bar, build buttons, toast messages and the pause screen. */
export class Hud {
  private readonly iron = byId("iron");
  private readonly ironStorage = byId("iron-storage");
  private readonly energy = byId("energy");
  private readonly energyStorage = byId("energy-storage");
  private readonly message = byId("message");
  private readonly pause = byId<HTMLDialogElement>("pause");
  private readonly buildButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-build]")];
  private messageTimer: number | undefined;
  private shown = "";

  constructor(handlers: {
    onBuild: (name: ObjectName) => void;
    onResume: () => void;
  }) {
    for (const button of this.buildButtons) {
      const name = button.dataset.build as ObjectName;
      if (!BUILDABLE.includes(name)) throw new Error(`Unknown buildable "${name}"`);
      button.addEventListener("click", () => handlers.onBuild(name));
    }

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

  update(economy: Economy, building: ObjectName | null): void {
    const key = `${economy.iron}|${economy.storage.iron}|${economy.energyPerHour}|${economy.storage.energy}|${building}`;
    if (key === this.shown) return;
    this.shown = key;

    this.iron.textContent = economy.iron.toLocaleString("en");
    this.ironStorage.textContent = economy.storage.iron.toLocaleString("en");
    const rate = economy.energyPerHour;
    this.energy.textContent = `${rate > 0 ? "+" : ""}${rate}`;
    this.energyStorage.textContent = economy.storage.energy.toLocaleString("en");

    for (const button of this.buildButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.build === building));
    }
  }

  showMessage(text: string, durationMs: number): void {
    this.message.textContent = text;
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
