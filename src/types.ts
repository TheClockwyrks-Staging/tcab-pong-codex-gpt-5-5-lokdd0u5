import type { CAROM_DEBUG_VERSION } from "./constants";

export type Side = "left" | "right";
export type Mode = "solo" | "versus";
export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";
export type Cue = "paddle-hit" | "wall-bounce" | "obstacle-bounce" | "score";
export type Action =
  | "p1-up"
  | "p1-down"
  | "p2-up"
  | "p2-down"
  | "confirm"
  | "back"
  | "pause"
  | "mute";

export type PaddleState = {
  cy: number;
  vy: number;
  driven: boolean;
  drivenVy: number;
};

export type BallState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  held: boolean;
  holdTimer: number;
  serveSign: 1 | -1;
  trail: TrailSample[];
};

export type TrailSample = { x: number; y: number; t: number };
export type ObstacleState = { index: number; cx: number; cy: number };

export type GameState = {
  screen: Screen;
  mode: Mode;
  menuIndex: number;
  titleIndex: number;
  resumeScreen: "countdown" | "playing";
  score: { p1: number; p2: number };
  winner: Side | null;
  receiver: Side;
  paddles: { left: PaddleState; right: PaddleState };
  ai: { tracking: boolean; movement: boolean };
  ball: BallState | null;
  obstacles: ObstacleState[];
  simTime: number;
  muted: boolean;
};

export type InputFrame = {
  held: Record<Action, boolean>;
  pressed: Record<Action, boolean>;
  pointer: PointerFrame;
  touches: PointerFrame[];
  userGesture: boolean;
};

export type PointerFrame = {
  id: number;
  x: number;
  y: number;
  moved: boolean;
  down: boolean;
  pressed: boolean;
  released: boolean;
};

export type MenuRect = { x: number; y: number; w: number; h: number };

export type AudioPort = {
  play(cue: Cue): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  arm(): void;
};

export type Snapshot = {
  version: typeof CAROM_DEBUG_VERSION;
  screen: Screen;
  mode: Mode;
  menuIndex: number;
  titleIndex: number;
  resumeScreen: "countdown" | "playing";
  score: { p1: number; p2: number };
  winner: Side | null;
  muted: boolean;
  paddles: {
    left: PaddleState;
    right: PaddleState;
  };
  ai: { tracking: boolean; movement: boolean };
  receiver: Side;
  ball: (BallState & { speed: number }) | null;
  obstacles: ObstacleState[];
  autoStep: boolean;
  simTime: number;
};

export type CaromDebugApi = {
  version: number;
  setAutoStep(enabled: boolean): void;
  advance(seconds: number, frames?: number): void;
  clearWorld(): void;
  spawnBall(): void;
  spawnObstacle(index: number): void;
  reset(): void;
  reconcile(): void;
  setScreen(screen: Screen): void;
  setMode(mode: Mode): void;
  setMenuIndex(index: number): void;
  setTitleIndex(index: number): void;
  setResumeScreen(screen: "countdown" | "playing"): void;
  setScore(p1: number, p2: number): void;
  setWinner(side: Side | null): void;
  setReceiver(side: Side): void;
  setPaddleCy(side: Side, cy: number): void;
  setPaddleVy(side: Side, vy: number): void;
  setPaddleDriven(side: Side, driven: boolean): void;
  setBallPosition(x: number, y: number): void;
  setBallVelocity(vx: number, vy: number): void;
  setBallSpin(spin: number): void;
  setBallHeld(held: boolean): void;
  setBallHoldTimer(seconds: number): void;
  setBallServeSign(sign: 1 | -1): void;
  drawBallServeSign(): void;
  setAiTracking(enabled: boolean): void;
  setAiMovement(enabled: boolean): void;
  setMuted(muted: boolean): void;
  snapshot(): Snapshot;
  menuItemRect(index: number): MenuRect | null;
};

declare global {
  interface Window {
    __carom: CaromDebugApi;
  }
}
