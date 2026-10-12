import { gridFromWorld, type Point, rectFromPoints } from "./coords";
import type { Hud } from "./hud";
import type { Renderer } from "./renderer";
import {
  build,
  buildTiles,
  type CameraKeys,
  cancelOrders,
  type GameState,
  issueOrder,
  noKeys,
  setSelection,
  zoomCamera,
} from "./state";

/** Screen drags shorter than this many pixels count as a click. */
const CLICK_PIXELS = 4;
/** Camera rotation per pixel of middle-mouse drag. */
const DRAG_ROTATE = 0.008;

const CAMERA_KEYS: Record<string, keyof CameraKeys> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyQ: "rotateLeft",
  KeyE: "rotateRight",
};

export function setPaused(state: GameState, hud: Hud, paused: boolean): void {
  state.paused = paused;
  hud.setPaused(paused);
}

/** Tracks the pointer on screen; the ground point under it is refreshed every frame. */
export interface ScreenPointer {
  position: Point | null;
  dragStart: Point | null;
  button: number | null;
}

/** Wire mouse and keyboard input to game commands, picking through the 3D view. */
export function bindInput(
  renderer: Renderer,
  state: GameState,
  hud: Hud,
  game: HTMLElement,
): ScreenPointer {
  const canvas = renderer.canvas;
  const screen: ScreenPointer = { position: null, dragStart: null, button: null };

  // The drag-select box is a plain DOM overlay.
  const box = document.createElement("div");
  box.className = "selection-box";
  box.hidden = true;
  game.append(box);

  const at = (event: PointerEvent | MouseEvent): Point => ({ x: event.clientX, y: event.clientY });
  const isClick = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < CLICK_PIXELS;

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener("pointermove", (event) => {
    const previous = screen.position;
    screen.position = at(event);

    if (screen.button === 1 && previous) {
      state.camera.yaw += (screen.position.x - previous.x) * DRAG_ROTATE;
      return;
    }
    // Show the selection box while left-dragging (not while placing buildings).
    if (screen.button === 0 && screen.dragStart && !state.building) {
      const rect = rectFromPoints(screen.dragStart, screen.position);
      box.hidden = isClick(screen.dragStart, screen.position);
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.right - rect.left}px`;
      box.style.height = `${rect.bottom - rect.top}px`;
    }
  });

  canvas.addEventListener("pointerleave", () => {
    if (screen.button === null) screen.position = null;
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button > 2) return;
    screen.position = at(event);
    screen.dragStart = at(event);
    screen.button = event.button;
    state.pointer.dragStart = renderer.groundAt(screen.position);
    canvas.setPointerCapture(event.pointerId);
    if (event.button === 1) event.preventDefault();
  });

  canvas.addEventListener("pointerup", (event) => {
    const start = screen.dragStart;
    const button = screen.button;
    screen.dragStart = null;
    screen.button = null;
    box.hidden = true;
    if (!start || button !== event.button || state.paused) {
      state.pointer.dragStart = null;
      return;
    }

    const end = at(event);
    state.pointer.world = renderer.groundAt(end);
    const click = isClick(start, end);
    const rect = rectFromPoints(start, end);

    if (button === 0) {
      if (state.building) {
        const { built, blocked, outOfIron } = build(
          state,
          state.building,
          buildTiles(state.pointer),
        );
        if (outOfIron) hud.showMessage(`Not enough iron to build a ${state.building}`, 10_000);
        else if (built === 0 && blocked > 0) hud.showMessage("You can't build there", 3_000);
        // Hold Shift to keep placing; a click on blocked ground keeps the building selected.
        if (!event.shiftKey && !outOfIron && built > 0) state.building = null;
      } else if (click) {
        const unit = renderer.unitAt(end, state.units);
        setSelection(state, unit ? [unit] : []);
      } else {
        setSelection(state, renderer.unitsInScreenRect(rect, state.units));
      }
    } else if (button === 2 && state.pointer.world) {
      const ground = state.pointer.world;
      let resources = click ? [] : renderer.resourcesInScreenRect(rect);
      if (click) {
        const resource = state.world.resourceAt(gridFromWorld(ground));
        if (resource) resources = [resource];
      }
      // Shift queues the order after the current ones instead of replacing them.
      issueOrder(state, ground, resources, event.shiftKey);
    }

    state.pointer.dragStart = null;
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoomCamera(state.camera, Math.exp(event.deltaY * 0.0012));
    },
    { passive: false },
  );

  document.addEventListener("keydown", (event) => {
    const key = CAMERA_KEYS[event.code];
    if (key) {
      state.keys[key] = true;
    } else if (event.key === "Shift") {
      state.keys.fast = true;
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
    const key = CAMERA_KEYS[event.code];
    if (key) state.keys[key] = false;
    else if (event.key === "Shift") state.keys.fast = false;
  });

  // Losing focus pauses the game and releases any held keys or buttons.
  window.addEventListener("blur", () => {
    state.keys = noKeys();
    state.pointer.dragStart = null;
    screen.dragStart = null;
    screen.button = null;
    box.hidden = true;
    setPaused(state, hud, true);
  });

  return screen;
}
