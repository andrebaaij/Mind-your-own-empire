/** The settings dialog: shows the current settings, and applies and saves every change. */

import { type Settings, saveSettings } from "./settings";

export function bindSettings(
  dialog: HTMLDialogElement,
  settings: Settings,
  handlers: { apply: (settings: Settings) => void; testVoice: () => void; closed: () => void },
): { open: () => void } {
  const form = dialog.querySelector<HTMLFormElement>("#settings-form");
  if (!form) throw new Error("Missing #settings-form");
  const field = (name: keyof Settings) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  const initialQuality = settings.quality;
  const reloadNote = dialog.querySelector<HTMLElement>("#settings-reload-note");

  // The controls list is the same one the help panel shows.
  const keys = dialog.querySelector("#settings-keys");
  const help = document.querySelector(".help .controls");
  if (keys && help && keys.childElementCount === 0) keys.append(help.cloneNode(true));

  const show = () => {
    for (const name of Object.keys(settings) as (keyof Settings)[]) {
      const input = field(name);
      if (!input) continue;
      const value = settings[name];
      if (input instanceof HTMLInputElement && input.type === "checkbox")
        input.checked = value === true;
      else input.value = String(value);
    }
    if (reloadNote) reloadNote.hidden = settings.quality === initialQuality;
  };

  form.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const name = input.name as keyof Settings;
    if (!(name in settings)) return;
    const next: Record<string, unknown> = { ...settings };
    if (input instanceof HTMLInputElement && input.type === "checkbox") next[name] = input.checked;
    else if (input instanceof HTMLInputElement && input.type === "range")
      next[name] = Number(input.value);
    else next[name] = input.value;
    Object.assign(settings, next);
    saveSettings(settings);
    handlers.apply(settings);
    show();
  });
  dialog
    .querySelector("#settings-voice-test")
    ?.addEventListener("click", () => handlers.testVoice());
  dialog
    .querySelector("#settings-reload")
    ?.addEventListener("click", () => window.location.reload());
  dialog.addEventListener("close", () => handlers.closed());

  return {
    open: () => {
      show();
      if (!dialog.open) dialog.showModal();
    },
  };
}
