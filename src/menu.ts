import "./styles/menu.css";
import { glowCss, PLAYER_COLORS, type PlayerColorName } from "./game/colors";

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
