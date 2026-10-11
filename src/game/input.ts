import { worldFromScreen } from "./coords";
import type { Hud } from "./hud";
import {
  build,
  buildTiles,
  cancelOrders,
  type GameState,
  issueOrder,
  selectInRect,
  selectionRect,
  setSelection,
} from "./state";

const SCROLL_KEYS: Record<string, keyof GameState["scroll"]> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

export function setPaused(state: GameState, hud: Hud, paused: boolean): void {
  state.paused = paused;
  hud.setPaused(paused);
}

/** Wire mouse and keyboard input on `canvas` to game commands. */
export function bindInput(canvas: HTMLCanvasElement, state: GameState, hud: Hud): void {
  const updatePointer = (event: PointerEvent) => {
    state.pointer.world = worldFromScreen({ x: event.clientX, y: event.clientY }, state.camera);
  };

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener("pointermove", updatePointer);

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    updatePointer(event);
    state.pointer.dragStart = { ...state.pointer.world };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!state.pointer.dragStart) return;
    if (state.paused) {
      state.pointer.dragStart = null;
      return;
    }
    updatePointer(event);
    const rect = selectionRect(state.pointer);

    if (event.button === 0) {
      if (state.building) {
        const { outOfIron } = build(state, state.building, buildTiles(state.pointer));
        if (outOfIron) hud.showMessage(`Not enough iron to build a ${state.building}`, 10_000);
        // Hold Shift to keep placing the same building.
        if (!event.shiftKey && !outOfIron) state.building = null;
      } else {
        selectInRect(state, rect);
      }
    } else if (event.button === 2) {
      issueOrder(state, rect, state.pointer.world);
    }

    state.pointer.dragStart = null;
  });

  document.addEventListener("keydown", (event) => {
    const direction = SCROLL_KEYS[event.code];
    if (direction) {
      state.scroll[direction] = true;
    } else if (event.key === "Shift") {
      state.scroll.fast = true;
    } else if (event.code === "Escape") {
      state.building = null;
      setSelection(state, []);
    } else if (event.code === "KeyC") {
      // C drops the next order of the selected units; Shift+C clears all their orders.
      cancelOrders(state, event.shiftKey);
    } else if (event.code === "KeyP") {
      setPaused(state, hud, !state.paused);
    } else {
      return;
    }
    event.preventDefault();
  });

  document.addEventListener("keyup", (event) => {
    const direction = SCROLL_KEYS[event.code];
    if (direction) state.scroll[direction] = false;
    else if (event.key === "Shift") state.scroll.fast = false;
  });

  // Losing focus pauses the game and releases any held keys or buttons.
  window.addEventListener("blur", () => {
    state.scroll = { up: false, down: false, left: false, right: false, fast: false };
    state.pointer.dragStart = null;
    setPaused(state, hud, true);
  });
}
