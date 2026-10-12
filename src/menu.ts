import "./styles/menu.css";
import { renderCodex } from "./game/codexStore";
import { glowCss, PLAYER_COLORS, type PlayerColorName } from "./game/colors";
import { completedMissions, isUnlocked, MISSIONS } from "./game/missions";
import { loadSaved } from "./game/save";

const swatches = document.getElementById("colors");
const seed = document.querySelector<HTMLInputElement>("#seed");
const randomSeed = document.getElementById("random-seed");

const setAccent = (name: PlayerColorName) => {
  document.documentElement.style.setProperty("--accent", glowCss(PLAYER_COLORS[name]));
};

// One radio button per player colour, drawn as a glowing swatch.
if (swatches) {
  for (const name of Object.keys(PLAYER_COLORS) as PlayerColorName[]) {
    const label = document.createElement("label");
    label.className = "swatch";
    label.title = name[0]?.toUpperCase() + name.slice(1);

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "color";
    input.value = name;
    input.checked = name === "cyan";
    input.addEventListener("change", () => setAccent(name));

    const dot = document.createElement("span");
    dot.className = "swatch-dot";
    dot.style.setProperty("--swatch", glowCss(PLAYER_COLORS[name]));

    const text = document.createElement("span");
    text.className = "visually-hidden";
    text.textContent = label.title;

    label.append(input, dot, text);
    swatches.append(label);
  }
  setAccent("cyan");
}

randomSeed?.addEventListener("click", () => {
  if (seed) seed.value = String(Math.floor(Math.random() * 1_000_000));
});

// The campaign: one submit button per mission, locked until the one before is done.
const missions = document.getElementById("missions");
if (missions) {
  const completed = completedMissions();
  let act = "";
  for (const mission of MISSIONS) {
    // A heading for each act.
    if (mission.act !== act) {
      act = mission.act;
      const heading = document.createElement("p");
      heading.className = "mission-act label";
      heading.textContent = act;
      missions.append(heading);
    }
    const unlocked = isUnlocked(mission, completed);
    const done = completed.has(mission.id);
    const button = document.createElement("button");
    button.type = "submit";
    button.name = "mission";
    button.value = mission.id;
    button.className = `mission${done ? " done" : ""}`;
    button.disabled = !unlocked;
    button.innerHTML = `
      <span class="mission-number">${mission.number}</span>
      <span class="mission-name">${mission.title}</span>
      <span class="mission-state">${done ? "Completed" : unlocked ? "Play" : "Locked"}</span>`;
    missions.append(button);
  }
}

// Carry on from the last save, if there is one.
const saved = loadSaved();
const resume = document.getElementById("continue");
if (saved && resume instanceof HTMLAnchorElement) {
  const what = saved.missionId
    ? (MISSIONS.find((m) => m.id === saved.missionId)?.title ?? "Campaign")
    : `Survey, world ${saved.seed}`;
  resume.hidden = false;
  resume.href = "./game.html?load=1";
  const detail = resume.querySelector(".continue-detail");
  if (detail) detail.textContent = `${what} · saved ${new Date(saved.savedAt).toLocaleString()}`;
}

// The codex, from what's been found in any game so far.
const codex = document.getElementById("codex");
document.getElementById("open-codex")?.addEventListener("click", () => {
  const entries = document.getElementById("codex-entries");
  if (!(codex instanceof HTMLDialogElement) || !entries) return;
  renderCodex(entries);
  codex.showModal();
});
