import { gridFromWorld, type Point, rectFromPoints } from "./coords";
import { BUILDABLE, getObjectDefinition, RESOURCE_LABEL } from "./definitions";
import type { Hud } from "./hud";
import type { Renderer } from "./renderer";
import type { Site } from "./sites";
import {
  build,
  buildTiles,
  type CameraKeys,
  canBuild,
  cancelOrders,
  type GameState,
  issueOrder,
  noKeys,
  setSelection,
  zoomCamera,
} from "./state";
import { setSilent } from "./stealth";
import type { Unit } from "./units";

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
  /** Control groups, by number. */
  const groups = new Map<number, Unit[]>();
  let lastGroup = { number: 0, time: 0 };
  let lastClick = { name: "", time: 0 };
  // Only the player's own units can be selected.
  const ownUnits = () => state.units.filter((unit) => unit.faction === "player");
  const isClick = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < CLICK_PIXELS;
  /** The Tessilend site under the pointer: its structure, or the ground it stands on. */
  const siteUnder = (screen: Point): Site | null => {
    const site = renderer.siteAt(screen);
    if (site) return site;
    const ground = renderer.groundAt(screen);
    const tile = ground ? gridFromWorld(ground) : null;
    return tile && state.world.isExplored(tile) ? (state.world.siteAt(tile) ?? null) : null;
  };

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
        const { built, blocked, shortOf } = build(state, state.building, buildTiles(state.pointer));
        const { label } = getObjectDefinition(state.building);
        if (shortOf)
          hud.showMessage(
            `Not enough ${RESOURCE_LABEL[shortOf]} for a ${label.toLowerCase()}. We appear to have built everything we can afford.`,
            5_000,
            "warning",
          );
        else if (built === 0 && blocked > 0)
          hud.showMessage(
            "I could put it there. It would then fall over. Let's not.",
            4_000,
            "warning",
          );
        // Hold Shift to keep placing; a click on blocked ground keeps the building selected.
        if (!event.shiftKey && !shortOf && built > 0) state.building = null;
      } else if (click) {
        const unit = renderer.unitAt(end, ownUnits());
        const now = performance.now();
        if (unit && lastClick.name === unit.name && now - lastClick.time < 350) {
          // Double-click: every unit of that kind on screen.
          const everything = { left: 0, top: 0, right: renderer.width, bottom: renderer.height };
          setSelection(
            state,
            renderer.unitsInScreenRect(everything, ownUnits()).filter((u) => u.name === unit.name),
          );
        } else {
          setSelection(state, unit ? [unit] : []);
        }
        lastClick = { name: unit?.name ?? "", time: now };
        // Clicking a Tessilend site shows what it is.
        state.inspecting = unit ? null : siteUnder(end);
      } else {
        state.inspecting = null;
        setSelection(state, renderer.unitsInScreenRect(rect, ownUnits()));
      }
    } else if (button === 2 && click && siteUnder(end)) {
      // Right-clicking a Tessilend site sends worker drones to study it.
      issueOrder(state, (siteUnder(end) as Site).center, [], event.shiftKey);
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
    // Keys belong to the dialog while a briefing or result is showing, and to the intro.
    if (document.querySelector("#mission-dialog[open], .cinematic")) return;
    const key = CAMERA_KEYS[event.code];
    if (key) {
      state.keys[key] = true;
    } else if (event.key === "Shift") {
      state.keys.fast = true;
    } else if (event.code === "Escape") {
      state.building = null;
      state.inspecting = null;
      setSelection(state, []);
    } else if (event.code === "KeyC") {
      // C drops the next order of the selected units; Shift+C clears all their orders.
      cancelOrders(state, event.shiftKey);
    } else if (/^Digit[1-9]$/.test(event.code) && (event.ctrlKey || event.metaKey)) {
      // Ctrl(+Shift)+number stores the selection as a control group.
      const number = Number(event.code.slice(5));
      groups.set(number, [...state.selection]);
      hud.showMessage(
        state.selection.length > 0
          ? `Group ${number}: ${state.selection.length} selected.`
          : `Group ${number} cleared.`,
        1_500,
      );
    } else if (/^Digit[1-9]$/.test(event.code) && event.shiftKey) {
      // Shift+number selects a control group; twice in quick succession looks at it.
      const number = Number(event.code.slice(5));
      const members = (groups.get(number) ?? []).filter((u) => state.units.includes(u));
      groups.set(number, members);
      if (members.length === 0) return;
      setSelection(state, members);
      const now = performance.now();
      const first = members[0];
      if (first && lastGroup.number === number && now - lastGroup.time < 400) {
        state.camera.target = { ...first.position };
      }
      lastGroup = { number, time: now };
    } else if (/^Digit[1-9]$/.test(event.code)) {
      // Number keys pick from the build bar; pressing the same one again puts it away.
      const name = BUILDABLE[Number(event.code.slice(5)) - 1];
      if (!name || !canBuild(state, name)) return;
      state.building = state.building === name ? null : name;
    } else if (event.code === "Period") {
      // Like AoE's idle-villager key: select idle worker drones and look at them.
      const idle = state.units.filter(
        (u) => u.faction === "player" && u.name === "block" && u.actions.length === 0,
      );
      if (idle.length === 0) {
        hud.showMessage("Nobody's idle. A first, I think.");
      } else {
        setSelection(state, idle);
        const first = idle[0];
        if (first) state.camera.target = { ...first.position };
      }
    } else if (event.code === "KeyR") {
      setSilent(state, !state.silent);
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
    if (document.querySelector("#mission-dialog[open]")) return;
    state.keys = noKeys();
    state.pointer.dragStart = null;
    screen.dragStart = null;
    screen.button = null;
    box.hidden = true;
    setPaused(state, hud, true);
  });

  return screen;
}
