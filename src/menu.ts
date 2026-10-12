import "./styles/menu.css";
import { glowCss, PLAYER_COLORS, type PlayerColorName } from "./game/colors";
import { completedMissions, isUnlocked, MISSIONS } from "./game/missions";

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
  for (const mission of MISSIONS) {
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
  const more = document.createElement("p");
  more.className = "mission-more";
  more.textContent = "More missions are on their way. So, the Mind suspects, is something else.";
  missions.append(more);
}
