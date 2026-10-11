import "./styles/menu.css";
import { playerColor, toCss } from "./game/colors";

const color = document.querySelector<HTMLSelectElement>("#color");
const play = document.querySelector<HTMLButtonElement>("#play");

if (color && play) {
  const update = () => {
    play.style.backgroundColor = toCss(playerColor(color.value));
  };
  color.addEventListener("change", update);
  update();
}
