import { describe, expect, it } from "vitest";
import {
  BALL_R,
  FIELD_CX,
  FIELD_CY,
  FIELD_W,
  HOLD_TIME,
  P1_X1,
  PADDLE_MAX_CY,
  PADDLE_SPEED,
  SERVE_SPEED,
  SPEED_MULT,
} from "./constants";
import { CaromGame, EMPTY_INPUT } from "./core";
import type { AudioPort, Cue, InputFrame } from "./types";

class FakeAudio implements AudioPort {
  cues: Cue[] = [];
  muted = false;
  armed = true;

  play(cue: Cue): void {
    if (!this.muted) this.cues.push(cue);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  arm(): void {
    this.armed = true;
  }
}

describe("CaromGame", () => {
  it("serves toward the receiver after the countdown without advancing the ball that frame", () => {
    const game = makeGame();
    game.startMatch("solo");
    game.state.ball!.serveSign = 1;
    game.update(HOLD_TIME, input());
    const ball = game.state.ball!;

    expect(game.state.screen).toBe("playing");
    expect(ball.held).toBe(false);
    expect(ball.holdTimer).toBe(0);
    expect(ball.x).toBe(FIELD_CX);
    expect(ball.y).toBe(FIELD_CY);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(SERVE_SPEED, 5);
    expect(ball.vx).toBeLessThan(0);
    expect(ball.vy).toBeGreaterThan(0);
  });

  it("integrates paddle velocity from the clamped movement", () => {
    const game = makeGame();
    game.startMatch("versus");
    game.state.paddles.left.cy = PADDLE_MAX_CY - 10;
    const frame = input();
    frame.held["p1-down"] = true;
    game.update(1, frame);

    expect(game.state.paddles.left.cy).toBe(PADDLE_MAX_CY);
    expect(game.state.paddles.left.vy).toBe(10);
    expect(game.state.paddles.left.vy).toBeLessThan(PADDLE_SPEED);
  });

  it("adds paddle spin and speed on a paddle face hit", () => {
    const audio = new FakeAudio();
    const game = makeGame(audio);
    game.startMatch("versus");
    game.state.screen = "playing";
    game.state.paddles.left.driven = true;
    game.state.paddles.left.drivenVy = 600;
    game.setBallPosition(P1_X1 + BALL_R + 1, FIELD_CY);
    game.setBallVelocity(-520, 0);
    game.ballOrThrow().held = false;

    game.update(1 / 60, input());
    const ball = game.state.ball!;

    expect(ball.x).toBeGreaterThanOrEqual(P1_X1 + BALL_R);
    expect(ball.vx).toBeGreaterThan(0);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(520 * SPEED_MULT, 5);
    expect(ball.spin).toBeGreaterThan(0);
    expect(audio.cues).toContain("paddle-hit");
  });

  it("parks the ball after a normal point and ends the match at the win rule", () => {
    const audio = new FakeAudio();
    const game = makeGame(audio);
    game.startMatch("versus");
    game.state.screen = "playing";
    game.setBallPosition(FIELD_W + BALL_R + 1, FIELD_CY);
    game.setBallVelocity(100, 0);
    game.ballOrThrow().held = false;
    game.update(0, input());

    expect(game.state.score.p1).toBe(1);
    expect(game.state.receiver).toBe("right");
    expect(game.state.screen).toBe("countdown");
    expect(game.state.ball!.held).toBe(true);
    expect(audio.cues).toContain("score");

    game.state.score = { p1: 10, p2: 8 };
    game.state.screen = "playing";
    game.setBallPosition(FIELD_W + BALL_R + 1, FIELD_CY);
    game.setBallVelocity(100, 0);
    game.ballOrThrow().held = false;
    game.update(0, input());

    expect(game.state.screen).toBe("matchover");
    expect(game.state.winner).toBe("left");
    expect(game.state.menuIndex).toBe(0);
  });

  it("fails loudly when a ball pose is applied to an empty field", () => {
    const game = makeGame();
    game.clearWorld();

    expect(() => game.setBallPosition(1, 2)).toThrow("No ball is present");
  });
});

function makeGame(audio = new FakeAudio()): CaromGame {
  return new CaromGame(audio);
}

function input(): InputFrame {
  return {
    held: { ...EMPTY_INPUT.held },
    pressed: { ...EMPTY_INPUT.pressed },
    pointer: { ...EMPTY_INPUT.pointer },
    touches: [],
    userGesture: false,
  };
}
