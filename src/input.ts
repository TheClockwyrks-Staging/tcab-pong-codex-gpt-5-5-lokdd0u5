import { FIELD_H, FIELD_W } from "./constants";
import type { Action, InputFrame, PointerFrame } from "./types";

const KEY_ACTIONS: Record<string, Action[]> = {
  KeyW: ["p1-up"],
  KeyS: ["p1-down"],
  ArrowUp: ["p2-up"],
  ArrowDown: ["p2-down"],
  Enter: ["confirm"],
  Space: ["confirm"],
  Escape: ["back", "pause"],
  KeyP: ["pause"],
  KeyM: ["mute"],
};

const ACTIONS: Action[] = [
  "p1-up",
  "p1-down",
  "p2-up",
  "p2-down",
  "confirm",
  "back",
  "pause",
  "mute",
];

export type Fit = {
  width: number;
  height: number;
  dpr: number;
  scale: number;
  x: number;
  y: number;
};

export class InputSystem {
  private readonly heldKeys = new Set<string>();
  private readonly pressedKeys = new Set<string>();
  private userGesture = false;
  private pointer: PointerFrame = makePointer();
  private touchFrames = new Map<number, PointerFrame>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private getFit: () => Fit,
    private toggleOverlay: () => void,
  ) {
    window.addEventListener("keydown", (event) => this.onKeyDown(event));
    window.addEventListener("keyup", (event) => this.onKeyUp(event));
    canvas.addEventListener("pointermove", (event) =>
      this.onPointerMove(event),
    );
    canvas.addEventListener("pointerdown", (event) =>
      this.onPointerDown(event),
    );
    canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    canvas.addEventListener("pointercancel", (event) =>
      this.onPointerUp(event),
    );
    canvas.addEventListener(
      "touchstart",
      (event) => this.onTouch(event, true, false),
      {
        passive: false,
      },
    );
    canvas.addEventListener(
      "touchmove",
      (event) => this.onTouch(event, false, false),
      {
        passive: false,
      },
    );
    canvas.addEventListener(
      "touchend",
      (event) => this.onTouch(event, false, true),
      {
        passive: false,
      },
    );
    canvas.addEventListener(
      "touchcancel",
      (event) => this.onTouch(event, false, true),
      {
        passive: false,
      },
    );
  }

  consumeFrame(): InputFrame {
    const held = Object.fromEntries(
      ACTIONS.map((action) => [action, this.isHeld(action)]),
    ) as Record<Action, boolean>;
    const pressed = Object.fromEntries(
      ACTIONS.map((action) => [action, this.isPressed(action)]),
    ) as Record<Action, boolean>;
    const frame = {
      held,
      pressed,
      pointer: { ...this.pointer },
      touches: [...this.touchFrames.values()].map((touch) => ({ ...touch })),
      userGesture: this.userGesture,
    };
    this.pressedKeys.clear();
    this.userGesture = false;
    this.pointer.moved = false;
    this.pointer.pressed = false;
    this.pointer.released = false;
    this.touchFrames.clear();
    return frame;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.code === "Backquote") {
      if (!event.repeat) this.toggleOverlay();
      event.preventDefault();
      return;
    }
    if (!KEY_ACTIONS[event.code]) return;
    if (!event.repeat) this.pressedKeys.add(event.code);
    this.heldKeys.add(event.code);
    this.userGesture = true;
    event.preventDefault();
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (!KEY_ACTIONS[event.code]) return;
    this.heldKeys.delete(event.code);
    event.preventDefault();
  }

  private onPointerMove(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    this.pointer = {
      ...this.toLogical(event.clientX, event.clientY),
      id: event.pointerId,
      moved: true,
      down: this.pointer.down,
      pressed: false,
      released: false,
    };
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    this.canvas.setPointerCapture(event.pointerId);
    this.userGesture = true;
    this.pointer = {
      ...this.toLogical(event.clientX, event.clientY),
      id: event.pointerId,
      moved: true,
      down: true,
      pressed: true,
      released: false,
    };
  }

  private onPointerUp(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    const previousPressed = this.pointer.pressed;
    this.pointer = {
      ...this.toLogical(event.clientX, event.clientY),
      id: event.pointerId,
      moved: true,
      down: false,
      pressed: previousPressed,
      released: true,
    };
  }

  private onTouch(
    event: TouchEvent,
    pressed: boolean,
    released: boolean,
  ): void {
    event.preventDefault();
    this.userGesture = this.userGesture || pressed;
    const touches = released ? event.changedTouches : event.touches;
    for (const touch of touches) {
      const previous = this.touchFrames.get(touch.identifier);
      this.touchFrames.set(touch.identifier, {
        ...this.toLogical(touch.clientX, touch.clientY),
        id: touch.identifier,
        moved: true,
        down: !released,
        pressed: Boolean(previous?.pressed || pressed),
        released,
      });
    }
  }

  private isHeld(action: Action): boolean {
    return Object.entries(KEY_ACTIONS).some(
      ([code, actions]) => actions.includes(action) && this.heldKeys.has(code),
    );
  }

  private isPressed(action: Action): boolean {
    return Object.entries(KEY_ACTIONS).some(
      ([code, actions]) =>
        actions.includes(action) && this.pressedKeys.has(code),
    );
  }

  private toLogical(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const fit = this.getFit();
    const x = (clientX - rect.left - fit.x) / fit.scale;
    const y = (clientY - rect.top - fit.y) / fit.scale;
    return { x: clampField(x, FIELD_W), y: clampField(y, FIELD_H) };
  }
}

export function computeFit(canvas: HTMLCanvasElement): Fit {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(rect.width / FIELD_W, rect.height / FIELD_H);
  const width = rect.width;
  const height = rect.height;
  return {
    width,
    height,
    dpr,
    scale,
    x: (width - FIELD_W * scale) / 2,
    y: (height - FIELD_H * scale) / 2,
  };
}

function makePointer(): PointerFrame {
  return {
    id: 0,
    x: -1,
    y: -1,
    moved: false,
    down: false,
    pressed: false,
    released: false,
  };
}

function clampField(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}
