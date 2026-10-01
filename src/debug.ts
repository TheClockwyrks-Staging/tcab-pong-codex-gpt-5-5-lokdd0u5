import { CAROM_DEBUG_VERSION } from "./constants";
import type { CaromGame } from "./core";
import type { InputFrame } from "./types";

export function installDebugApi(
  game: CaromGame,
  render: () => void,
  stepInput: () => InputFrame,
): void {
  window.__carom = {
    version: CAROM_DEBUG_VERSION,
    setAutoStep: (enabled) => game.setAutoStep(enabled),
    advance: (seconds, frames = 1) => {
      const count = Math.max(1, Math.floor(frames));
      const dt = seconds / count;
      for (let i = 0; i < count; i += 1) {
        game.update(dt, stepInput());
        render();
      }
    },
    clearWorld: () => game.clearWorld(),
    spawnBall: () => game.spawnBall(),
    spawnObstacle: (index) => game.spawnObstacle(index),
    reset: () => game.reset(),
    reconcile: () => undefined,
    setScreen: (screen) => {
      game.state.screen = screen;
    },
    setMode: (mode) => {
      game.state.mode = mode;
    },
    setMenuIndex: (index) => {
      game.state.menuIndex = index;
    },
    setTitleIndex: (index) => {
      game.state.titleIndex = index;
    },
    setResumeScreen: (screen) => {
      game.state.resumeScreen = screen;
    },
    setScore: (p1, p2) => {
      game.state.score = { p1, p2 };
    },
    setWinner: (side) => {
      game.state.winner = side;
    },
    setReceiver: (side) => {
      game.state.receiver = side;
    },
    setPaddleCy: (side, cy) => {
      game.state.paddles[side].cy = cy;
    },
    setPaddleVy: (side, vy) => {
      game.state.paddles[side].drivenVy = vy;
    },
    setPaddleDriven: (side, driven) => {
      game.state.paddles[side].driven = driven;
    },
    setBallPosition: (x, y) => game.setBallPosition(x, y),
    setBallVelocity: (vx, vy) => game.setBallVelocity(vx, vy),
    setBallSpin: (spin) => {
      game.ballOrThrow().spin = spin;
    },
    setBallHeld: (held) => {
      game.ballOrThrow().held = held;
    },
    setBallHoldTimer: (seconds) => {
      game.ballOrThrow().holdTimer = seconds;
    },
    setBallServeSign: (sign) => {
      if (sign !== 1 && sign !== -1)
        throw new Error("Serve sign must be 1 or -1");
      game.ballOrThrow().serveSign = sign;
    },
    drawBallServeSign: () => game.drawBallServeSign(),
    setAiTracking: (enabled) => {
      game.state.ai.tracking = enabled;
    },
    setAiMovement: (enabled) => {
      game.state.ai.movement = enabled;
    },
    setMuted: (muted) => {
      game.setMuted(muted);
    },
    snapshot: () => game.snapshot(),
    menuItemRect: (index) => game.menuItemRect(index),
  };
}
