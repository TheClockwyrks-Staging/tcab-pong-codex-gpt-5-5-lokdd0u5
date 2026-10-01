import {
  AI_DEADZONE,
  AI_HOME_DEADZONE,
  AI_HOME_Y,
  AI_REACT,
  AI_SPEED,
  BALL_R,
  CAROM_DEBUG_VERSION,
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_W,
  HOLD_TIME,
  HOWTO_ITEMS,
  MATCHOVER_ITEMS,
  MAX_BOUNCE_ANGLE,
  MAX_SUBSTEP,
  OBSTACLE_CENTERS,
  OBSTACLE_HH,
  OBSTACLE_HW,
  P1_X0,
  P1_X1,
  P2_X0,
  P2_X1,
  PADDLE_HALF,
  PADDLE_MAX_CY,
  PADDLE_MIN_CY,
  PADDLE_SPEED,
  PAUSE_ITEMS,
  SERVE_ANGLE,
  SERVE_SPEED,
  SPEED_CAP,
  SPEED_MULT,
  SPIN_CLAMP,
  SPIN_FROM_PADDLE,
  SPIN_HALFLIFE,
  TITLE_ITEMS,
  TRAIL_TIME,
  WIN_LEAD,
  WIN_SCORE,
} from "./constants";
import { clamp, randomServeSign, wrapIndex } from "./math";
import type {
  AudioPort,
  BallState,
  Cue,
  GameState,
  InputFrame,
  MenuRect,
  Mode,
  ObstacleState,
  PaddleState,
  Screen,
  Side,
  Snapshot,
} from "./types";

const emptyPointer = {
  id: 0,
  x: -1,
  y: -1,
  moved: false,
  down: false,
  pressed: false,
  released: false,
};

export const EMPTY_INPUT: InputFrame = {
  held: {
    "p1-up": false,
    "p1-down": false,
    "p2-up": false,
    "p2-down": false,
    confirm: false,
    back: false,
    pause: false,
    mute: false,
  },
  pressed: {
    "p1-up": false,
    "p1-down": false,
    "p2-up": false,
    "p2-down": false,
    confirm: false,
    back: false,
    pause: false,
    mute: false,
  },
  pointer: emptyPointer,
  touches: [],
  userGesture: false,
};

type Rect = { x0: number; x1: number; y0: number; y1: number };
type HitFace = "left" | "right" | "top" | "bottom";
type CollisionResult = { hit: boolean; face: HitFace | null };

export class CaromGame {
  state: GameState;

  private autoStep = true;

  private pointerPressIndex: number | null = null;

  private touchPressIndex = new Map<number, number>();

  constructor(private readonly audio: AudioPort) {
    this.state = this.createTitleState();
  }

  setAutoStep(enabled: boolean): void {
    this.autoStep = enabled;
  }

  isAutoStep(): boolean {
    return this.autoStep;
  }

  update(dt: number, input: InputFrame = EMPTY_INPUT): void {
    const safeDt = Math.max(0, dt);
    const startScreen = this.state.screen;
    if (input.userGesture) this.audio.arm();
    this.state.simTime += safeDt;
    const cues = new Set<Cue>();
    this.handleInput(startScreen, input);

    if (this.state.screen === "countdown") {
      this.advancePaddles(safeDt, input);
      this.advanceCountdown(safeDt);
      this.recordTrail();
    } else if (this.state.screen === "playing") {
      this.advancePaddles(safeDt, input);
      this.advanceBall(safeDt, cues);
      this.recordTrail();
      this.checkScore(cues);
    }

    this.state.muted = this.audio.isMuted();
    for (const cue of cues) this.audio.play(cue);
  }

  reset(): void {
    const muted = this.audio.isMuted();
    this.state = this.createTitleState();
    this.state.muted = muted;
    this.pointerPressIndex = null;
    this.touchPressIndex.clear();
  }

  startMatch(mode: Mode = this.state.mode): void {
    this.state.mode = mode;
    this.state.screen = "countdown";
    this.state.resumeScreen = "playing";
    this.state.menuIndex = 0;
    this.state.score = { p1: 0, p2: 0 };
    this.state.winner = null;
    this.state.receiver = "left";
    this.spawnBall();
    this.state.paddles.left.cy = FIELD_CY;
    this.state.paddles.left.vy = 0;
    this.state.paddles.right.cy = FIELD_CY;
    this.state.paddles.right.vy = 0;
  }

  returnToTitle(): void {
    const titleIndex = this.state.titleIndex;
    const simTime = this.state.simTime;
    const muted = this.audio.isMuted();
    this.state = this.createTitleState();
    this.state.titleIndex = titleIndex;
    this.state.menuIndex = titleIndex;
    this.state.simTime = simTime;
    this.state.muted = muted;
  }

  clearWorld(): void {
    this.state.ball = null;
    this.state.obstacles = [];
  }

  spawnBall(): void {
    this.state.ball = this.parkedBall();
  }

  spawnObstacle(index: number): void {
    const center = OBSTACLE_CENTERS[index];
    if (!center) throw new Error(`No obstacle index ${index}`);
    const obstacle = { index, cx: center.cx, cy: center.cy };
    this.state.obstacles = [
      ...this.state.obstacles.filter((item) => item.index !== index),
      obstacle,
    ].sort((a, b) => a.index - b.index);
  }

  drawBallServeSign(): void {
    this.requireBall().serveSign = randomServeSign();
  }

  setBallPosition(x: number, y: number): void {
    const ball = this.requireBall();
    ball.x = x;
    ball.y = y;
  }

  setBallVelocity(vx: number, vy: number): void {
    const ball = this.requireBall();
    ball.vx = vx;
    ball.vy = vy;
  }

  ballOrThrow(): BallState {
    return this.requireBall();
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
    this.state.muted = this.audio.isMuted();
  }

  snapshot(): Snapshot {
    const ball = this.state.ball;
    return {
      version: CAROM_DEBUG_VERSION,
      screen: this.state.screen,
      mode: this.state.mode,
      menuIndex: this.state.menuIndex,
      titleIndex: this.state.titleIndex,
      resumeScreen: this.state.resumeScreen,
      score: { ...this.state.score },
      winner: this.state.winner,
      muted: this.audio.isMuted(),
      paddles: {
        left: { ...this.state.paddles.left },
        right: { ...this.state.paddles.right },
      },
      ai: { ...this.state.ai },
      receiver: this.state.receiver,
      ball: ball
        ? {
            ...ball,
            speed: Math.hypot(ball.vx, ball.vy),
            trail: ball.trail.map((sample) => ({ ...sample })),
          }
        : null,
      obstacles: this.state.obstacles.map((obstacle) => ({ ...obstacle })),
      autoStep: this.autoStep,
      simTime: this.state.simTime,
    };
  }

  menuItemRect(index: number): MenuRect | null {
    const count = this.menuCount();
    if (count === 0 || index < 0 || index >= count) return null;
    const w = this.state.screen === "howto" ? 220 : 360;
    const h = 58;
    const gap = 16;
    const x = FIELD_CX - w / 2;
    const y = this.menuStartY() + index * (h + gap);
    return { x, y, w, h };
  }

  diagnostics(): string[] {
    const ball = this.state.ball;
    return [
      `screen ${this.state.screen} mode ${this.state.mode}`,
      `score ${this.state.score.p1}-${this.state.score.p2}`,
      ball
        ? `ball ${ball.x.toFixed(1)},${ball.y.toFixed(1)} v ${ball.vx.toFixed(1)},${ball.vy.toFixed(1)} s ${Math.hypot(ball.vx, ball.vy).toFixed(1)} spin ${ball.spin.toFixed(1)}`
        : "ball none",
      `left cy ${this.state.paddles.left.cy.toFixed(1)} vy ${this.state.paddles.left.vy.toFixed(1)}`,
      `right cy ${this.state.paddles.right.cy.toFixed(1)} vy ${this.state.paddles.right.vy.toFixed(1)}`,
    ];
  }

  private createTitleState(): GameState {
    return {
      screen: "title",
      mode: "solo",
      menuIndex: 0,
      titleIndex: 0,
      resumeScreen: "playing",
      score: { p1: 0, p2: 0 },
      winner: null,
      receiver: "left",
      paddles: {
        left: this.createPaddle(),
        right: this.createPaddle(),
      },
      ai: { tracking: true, movement: true },
      ball: this.parkedBall(),
      obstacles: OBSTACLE_CENTERS.map((center, index) => ({
        index,
        cx: center.cx,
        cy: center.cy,
      })),
      simTime: 0,
      muted: this.audio.isMuted(),
    };
  }

  private createPaddle(): PaddleState {
    return { cy: FIELD_CY, vy: 0, driven: false, drivenVy: 0 };
  }

  private parkedBall(): BallState {
    return {
      x: FIELD_CX,
      y: FIELD_CY,
      vx: 0,
      vy: 0,
      spin: 0,
      held: true,
      holdTimer: HOLD_TIME,
      serveSign: randomServeSign(),
      trail: [],
    };
  }

  private handleInput(startScreen: Screen, input: InputFrame): void {
    if (input.pressed.mute) {
      this.audio.setMuted(!this.audio.isMuted());
      this.state.muted = this.audio.isMuted();
    }

    if (startScreen === "title") this.handleTitleInput(input);
    if (startScreen === "howto") this.handleHowtoInput(input);
    if (startScreen === "countdown" || startScreen === "playing") {
      if (input.pressed.pause) {
        this.state.resumeScreen = startScreen;
        this.state.screen = "paused";
        this.state.menuIndex = 0;
      }
    }
    if (startScreen === "paused") this.handlePausedInput(input);
    if (startScreen === "matchover") this.handleMatchoverInput(input);
  }

  private handleTitleInput(input: InputFrame): void {
    this.menuKeyboard(input, TITLE_ITEMS.length, () => {
      this.state.titleIndex = this.state.menuIndex;
      if (this.state.menuIndex === 0) this.startMatch("solo");
      else if (this.state.menuIndex === 1) this.startMatch("versus");
      else {
        this.state.screen = "howto";
        this.state.menuIndex = 0;
      }
    });
    this.applyPointerMenu(input, () => {
      this.state.titleIndex = this.state.menuIndex;
      if (this.state.menuIndex === 0) this.startMatch("solo");
      else if (this.state.menuIndex === 1) this.startMatch("versus");
      else {
        this.state.screen = "howto";
        this.state.menuIndex = 0;
      }
    });
  }

  private handleHowtoInput(input: InputFrame): void {
    if (input.pressed.confirm || input.pressed.back) {
      this.returnToTitle();
      return;
    }
    this.applyPointerMenu(input, () => this.returnToTitle());
  }

  private handlePausedInput(input: InputFrame): void {
    if (input.pressed.pause || input.pressed.back) {
      this.state.screen = this.state.resumeScreen;
      return;
    }
    this.menuKeyboard(input, PAUSE_ITEMS.length, () => {
      if (this.state.menuIndex === 0)
        this.state.screen = this.state.resumeScreen;
      else if (this.state.menuIndex === 1) this.startMatch(this.state.mode);
      else this.returnToTitle();
    });
    this.applyPointerMenu(input, () => {
      if (this.state.menuIndex === 0)
        this.state.screen = this.state.resumeScreen;
      else if (this.state.menuIndex === 1) this.startMatch(this.state.mode);
      else this.returnToTitle();
    });
  }

  private handleMatchoverInput(input: InputFrame): void {
    if (input.pressed.back) {
      this.returnToTitle();
      return;
    }
    this.menuKeyboard(input, MATCHOVER_ITEMS.length, () => {
      if (this.state.menuIndex === 0) this.startMatch(this.state.mode);
      else this.returnToTitle();
    });
    this.applyPointerMenu(input, () => {
      if (this.state.menuIndex === 0) this.startMatch(this.state.mode);
      else this.returnToTitle();
    });
  }

  private menuKeyboard(
    input: InputFrame,
    count: number,
    confirm: () => void,
  ): void {
    const up = input.pressed["p1-up"] || input.pressed["p2-up"];
    const down = input.pressed["p1-down"] || input.pressed["p2-down"];
    if (up) this.state.menuIndex = wrapIndex(this.state.menuIndex - 1, count);
    else if (down)
      this.state.menuIndex = wrapIndex(this.state.menuIndex + 1, count);
    else if (input.pressed.confirm) confirm();
  }

  private applyPointerMenu(input: InputFrame, confirm: () => void): void {
    if (input.pressed.confirm) return;
    const items = this.menuCount();
    let pointerReleaseIndex: number | null = null;
    const touchReleaseIds: number[] = [];
    for (let index = 0; index < items; index += 1) {
      const rect = this.menuItemRect(index);
      if (!rect) continue;
      if (
        (input.pointer.moved ||
          input.pointer.pressed ||
          input.pointer.released) &&
        pointInRect(input.pointer.x, input.pointer.y, rect)
      ) {
        this.state.menuIndex = index;
      }
      if (
        input.pointer.pressed &&
        pointInRect(input.pointer.x, input.pointer.y, rect)
      ) {
        this.pointerPressIndex = index;
      }
      if (
        input.pointer.released &&
        pointInRect(input.pointer.x, input.pointer.y, rect)
      ) {
        pointerReleaseIndex = index;
      }
      for (const touch of input.touches) {
        if (
          (touch.moved || touch.pressed || touch.released) &&
          pointInRect(touch.x, touch.y, rect)
        ) {
          this.state.menuIndex = index;
        }
        if (touch.pressed && pointInRect(touch.x, touch.y, rect)) {
          this.touchPressIndex.set(touch.id, index);
        }
        if (touch.released && pointInRect(touch.x, touch.y, rect)) {
          touchReleaseIds.push(touch.id);
        }
      }
    }
    const confirmed =
      pointerReleaseIndex !== null &&
      pointerReleaseIndex === this.pointerPressIndex;
    const touchConfirmed = input.touches.some((touch) => {
      const start = this.touchPressIndex.get(touch.id);
      return (
        touch.released &&
        start === this.state.menuIndex &&
        touchReleaseIds.includes(touch.id)
      );
    });
    if (input.pointer.released) this.pointerPressIndex = null;
    for (const touch of input.touches) {
      if (touch.released) this.touchPressIndex.delete(touch.id);
    }
    if (confirmed || touchConfirmed) confirm();
  }

  private advancePaddles(dt: number, input: InputFrame): void {
    const left = this.state.paddles.left;
    const right = this.state.paddles.right;
    this.integratePaddle(left, this.paddleCommand("left", dt, input), dt);
    this.integratePaddle(right, this.paddleCommand("right", dt, input), dt);
  }

  private paddleCommand(side: Side, dt: number, input: InputFrame): number {
    const paddle = this.state.paddles[side];
    if (paddle.driven) return paddle.drivenVy;
    if (side === "left") {
      const up =
        input.held["p1-up"] ||
        (this.state.mode === "solo" && input.held["p2-up"]);
      const down =
        input.held["p1-down"] ||
        (this.state.mode === "solo" && input.held["p2-down"]);
      return (Number(down) - Number(up)) * PADDLE_SPEED;
    }
    if (this.state.mode === "versus") {
      return (
        (Number(input.held["p2-down"]) - Number(input.held["p2-up"])) *
        PADDLE_SPEED
      );
    }
    return this.aiVelocity(dt);
  }

  private aiVelocity(dt: number): number {
    if (!this.state.ai.movement || dt <= 0) return 0;
    const ball = this.state.ball;
    let target = AI_HOME_Y;
    let deadzone = AI_HOME_DEADZONE;
    if (
      this.state.ai.tracking &&
      this.state.screen === "playing" &&
      ball &&
      ball.vx > 0
    ) {
      target = ball.y - ball.vy * AI_REACT;
      deadzone = AI_DEADZONE;
    }
    const diff = target - this.state.paddles.right.cy;
    if (Math.abs(diff) <= deadzone) return 0;
    return Math.sign(diff) * Math.min(AI_SPEED, Math.abs(diff) / dt);
  }

  private integratePaddle(
    paddle: PaddleState,
    desiredVy: number,
    dt: number,
  ): void {
    if (dt <= 0) {
      paddle.vy = 0;
      return;
    }
    const cy = paddle.cy;
    const next = clamp(cy + desiredVy * dt, PADDLE_MIN_CY, PADDLE_MAX_CY);
    paddle.vy = next !== cy ? (next - cy) / dt : 0;
    paddle.cy = next;
  }

  private advanceCountdown(dt: number): void {
    const ball = this.state.ball;
    if (!ball) return;
    ball.x = FIELD_CX;
    ball.y = FIELD_CY;
    if (!ball.held) return;
    ball.holdTimer -= dt;
    if (ball.holdTimer <= 0) {
      ball.holdTimer = 0;
      ball.held = false;
      ball.trail = [];
      const dir = this.state.receiver === "left" ? -1 : 1;
      ball.vx = dir * SERVE_SPEED * Math.cos(SERVE_ANGLE);
      ball.vy = ball.serveSign * SERVE_SPEED * Math.sin(SERVE_ANGLE);
      this.state.screen = "playing";
    }
  }

  private advanceBall(dt: number, cues: Set<Cue>): void {
    const ball = this.state.ball;
    if (!ball || ball.held || dt <= 0) return;
    const speed = Math.hypot(ball.vx, ball.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / MAX_SUBSTEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      this.advanceBallSubstep(ball, h, cues);
    }
  }

  private advanceBallSubstep(ball: BallState, h: number, cues: Set<Cue>): void {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) {
      const angle = (ball.spin / speed) * h;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const vx = ball.vx * cos - ball.vy * sin;
      const vy = ball.vx * sin + ball.vy * cos;
      ball.vx = vx;
      ball.vy = vy;
    }
    ball.spin *= 0.5 ** (h / SPIN_HALFLIFE);
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;

    if (ball.y - BALL_R < 0 && ball.vy < 0) {
      ball.y = BALL_R;
      ball.vy = -ball.vy;
      cues.add("wall-bounce");
    } else if (ball.y + BALL_R > FIELD_H && ball.vy > 0) {
      ball.y = FIELD_H - BALL_R;
      ball.vy = -ball.vy;
      cues.add("wall-bounce");
    }

    this.resolvePaddle(ball, "left", cues);
    this.resolvePaddle(ball, "right", cues);
    for (const obstacle of this.state.obstacles)
      this.resolveObstacle(ball, obstacle, cues);
  }

  private resolvePaddle(ball: BallState, side: Side, cues: Set<Cue>): void {
    const paddle = this.state.paddles[side];
    const rect =
      side === "left"
        ? {
            x0: P1_X0,
            x1: P1_X1,
            y0: paddle.cy - PADDLE_HALF,
            y1: paddle.cy + PADDLE_HALF,
          }
        : {
            x0: P2_X0,
            x1: P2_X1,
            y0: paddle.cy - PADDLE_HALF,
            y1: paddle.cy + PADDLE_HALF,
          };
    const result = resolveCircleRect(ball, rect);
    if (!result.hit) return;
    if (result.face === "top" || result.face === "bottom") {
      cues.add("wall-bounce");
      return;
    }
    const offset = clamp((ball.y - paddle.cy) / PADDLE_HALF, -1, 1);
    const theta = offset * MAX_BOUNCE_ANGLE;
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    const speed = Math.min(currentSpeed * SPEED_MULT, SPEED_CAP);
    const dir = side === "left" ? 1 : -1;
    ball.vx = dir * speed * Math.cos(theta);
    ball.vy = speed * Math.sin(theta);
    ball.spin = clamp(
      ball.spin + paddle.vy * SPIN_FROM_PADDLE,
      -SPIN_CLAMP,
      SPIN_CLAMP,
    );
    ball.x = side === "left" ? P1_X1 + BALL_R : P2_X0 - BALL_R;
    cues.add("paddle-hit");
  }

  private resolveObstacle(
    ball: BallState,
    obstacle: ObstacleState,
    cues: Set<Cue>,
  ): void {
    const result = resolveCircleRect(ball, {
      x0: obstacle.cx - OBSTACLE_HW,
      x1: obstacle.cx + OBSTACLE_HW,
      y0: obstacle.cy - OBSTACLE_HH,
      y1: obstacle.cy + OBSTACLE_HH,
    });
    if (result.hit) cues.add("obstacle-bounce");
  }

  private checkScore(cues: Set<Cue>): void {
    const ball = this.state.ball;
    if (!ball) return;
    let scorer: Side | null = null;
    if (ball.x - BALL_R > FIELD_W) scorer = "left";
    if (ball.x + BALL_R < 0) scorer = "right";
    if (!scorer) return;
    cues.add("score");
    if (scorer === "left") this.state.score.p1 += 1;
    else this.state.score.p2 += 1;
    if (
      this.state.score.p1 >= WIN_SCORE &&
      this.state.score.p1 - this.state.score.p2 >= WIN_LEAD
    ) {
      this.state.winner = "left";
      this.state.screen = "matchover";
      this.state.menuIndex = 0;
    } else if (
      this.state.score.p2 >= WIN_SCORE &&
      this.state.score.p2 - this.state.score.p1 >= WIN_LEAD
    ) {
      this.state.winner = "right";
      this.state.screen = "matchover";
      this.state.menuIndex = 0;
    } else {
      this.spawnBall();
      this.state.receiver = scorer === "left" ? "right" : "left";
      if (this.state.ball) this.state.ball.holdTimer = HOLD_TIME;
      this.state.screen = "countdown";
    }
  }

  private recordTrail(): void {
    const ball = this.state.ball;
    if (!ball) return;
    ball.trail.push({ x: ball.x, y: ball.y, t: this.state.simTime });
    const oldest = this.state.simTime - TRAIL_TIME;
    ball.trail = ball.trail.filter((sample) => sample.t >= oldest);
  }

  private requireBall(): BallState {
    if (!this.state.ball) throw new Error("No ball is present");
    return this.state.ball;
  }

  private menuCount(): number {
    if (this.state.screen === "title") return TITLE_ITEMS.length;
    if (this.state.screen === "howto") return HOWTO_ITEMS.length;
    if (this.state.screen === "paused") return PAUSE_ITEMS.length;
    if (this.state.screen === "matchover") return MATCHOVER_ITEMS.length;
    return 0;
  }

  private menuStartY(): number {
    if (this.state.screen === "title") return 365;
    if (this.state.screen === "howto") return 590;
    return 390;
  }
}

function pointInRect(x: number, y: number, rect: MenuRect): boolean {
  return (
    x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  );
}

function resolveCircleRect(ball: BallState, rect: Rect): CollisionResult {
  const left = ball.x - (rect.x0 - BALL_R);
  const right = rect.x1 + BALL_R - ball.x;
  const top = ball.y - (rect.y0 - BALL_R);
  const bottom = rect.y1 + BALL_R - ball.y;
  if (!(left > 0 && right > 0 && top > 0 && bottom > 0)) {
    return { hit: false, face: null };
  }
  let face: HitFace = "left";
  let depth = left;
  if (right < depth) {
    depth = right;
    face = "right";
  }
  if (top < depth) {
    depth = top;
    face = "top";
  }
  if (bottom < depth) face = "bottom";

  if (face === "left") {
    ball.x = rect.x0 - BALL_R;
    if (ball.vx > 0) ball.vx = -ball.vx;
  } else if (face === "right") {
    ball.x = rect.x1 + BALL_R;
    if (ball.vx < 0) ball.vx = -ball.vx;
  } else if (face === "top") {
    ball.y = rect.y0 - BALL_R;
    if (ball.vy > 0) ball.vy = -ball.vy;
  } else {
    ball.y = rect.y1 + BALL_R;
    if (ball.vy < 0) ball.vy = -ball.vy;
  }
  return { hit: true, face };
}
