import {
  BALL_COLOR,
  BALL_R,
  FIELD_BG,
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_W,
  HOWTO_ITEMS,
  LEFT_COLOR,
  MATCHOVER_ITEMS,
  NET_X,
  OBSTACLE_COLOR,
  OBSTACLE_H,
  OBSTACLE_W,
  P1_X0,
  P2_X0,
  PADDLE_H,
  PADDLE_W,
  PAUSE_ITEMS,
  RIGHT_COLOR,
  TITLE_ITEMS,
  TITLE_TEXT,
} from "./constants";
import type { CaromGame } from "./core";
import type { Fit } from "./input";
import type { BallState, MenuRect, PaddleState } from "./types";

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create 2D canvas context");
    this.ctx = context;
  }

  render(game: CaromGame, fit: Fit, overlay: boolean): void {
    this.resize(fit);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0);
    ctx.fillStyle = FIELD_BG;
    ctx.fillRect(0, 0, fit.width, fit.height);
    ctx.translate(fit.x, fit.y);
    ctx.scale(fit.scale, fit.scale);
    this.drawField(game);
    this.drawScreen(game);
    if (overlay) this.drawOverlay(game);
    ctx.restore();
  }

  private resize(fit: Fit): void {
    const width = Math.max(1, Math.floor(fit.width * fit.dpr));
    const height = Math.max(1, Math.floor(fit.height * fit.dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private drawField(game: CaromGame): void {
    const state = game.state;
    const ctx = this.ctx;
    ctx.fillStyle = FIELD_BG;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    this.drawGridGlow();
    this.drawNet();
    for (const obstacle of state.obstacles) {
      roundedRect(
        ctx,
        obstacle.cx - OBSTACLE_W / 2,
        obstacle.cy - OBSTACLE_H / 2,
        OBSTACLE_W,
        OBSTACLE_H,
        10,
        OBSTACLE_COLOR,
        "rgba(120,166,255,0.35)",
      );
    }
    this.drawPaddle(P1_X0, state.paddles.left, LEFT_COLOR);
    this.drawPaddle(P2_X0, state.paddles.right, RIGHT_COLOR);
    if (state.ball) this.drawBall(state.ball);
    if (state.screen === "playing" || state.screen === "countdown") {
      this.drawHud(game);
    }
  }

  private drawScreen(game: CaromGame): void {
    const screen = game.state.screen;
    if (screen === "title") this.drawTitle(game);
    if (screen === "howto") this.drawHowto(game);
    if (screen === "countdown") this.drawCountdown(game);
    if (screen === "paused") this.drawPaused(game);
    if (screen === "matchover") this.drawMatchover(game);
  }

  private drawGridGlow(): void {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(
      FIELD_CX,
      FIELD_CY,
      80,
      FIELD_CX,
      FIELD_CY,
      650,
    );
    gradient.addColorStop(0, "rgba(31,245,199,0.08)");
    gradient.addColorStop(0.55, "rgba(255,93,143,0.045)");
    gradient.addColorStop(1, "rgba(7,16,22,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    for (let x = 80; x < FIELD_W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD_H);
      ctx.stroke();
    }
  }

  private drawNet(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(235,248,255,0.38)";
    ctx.setLineDash([18, 18]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(NET_X, 42);
    ctx.lineTo(NET_X, FIELD_H - 42);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawPaddle(x: number, paddle: PaddleState, color: string): void {
    roundedRect(
      this.ctx,
      x,
      paddle.cy - PADDLE_H / 2,
      PADDLE_W,
      PADDLE_H,
      8,
      color,
      `${color}66`,
    );
  }

  private drawBall(ball: BallState): void {
    const ctx = this.ctx;
    if (ball.trail.length > 1) {
      ctx.lineCap = "round";
      for (let i = 1; i < ball.trail.length; i += 1) {
        const a = ball.trail[i - 1];
        const b = ball.trail[i];
        const alpha = i / ball.trail.length;
        ctx.strokeStyle = `rgba(255,240,106,${0.08 + alpha * 0.34})`;
        ctx.lineWidth = 4 + alpha * 6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.shadowColor = "rgba(255,240,106,0.85)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = BALL_COLOR;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private drawHud(game: CaromGame): void {
    const ctx = this.ctx;
    const state = game.state;
    ctx.fillStyle = "rgba(235,248,255,0.92)";
    ctx.font = "700 54px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(state.score.p1), FIELD_CX - 110, 74);
    ctx.fillText(String(state.score.p2), FIELD_CX + 110, 74);
    ctx.font = "700 18px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(235,248,255,0.62)";
    ctx.fillText(
      state.mode === "solo" ? "SOLO DUEL" : "VERSUS DUEL",
      FIELD_CX,
      38,
    );
  }

  private drawTitle(game: CaromGame): void {
    this.dim();
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.font = "900 110px Inter, system-ui, sans-serif";
    ctx.fillText(TITLE_TEXT, FIELD_CX, 210);
    ctx.font = "500 22px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(235,248,255,0.72)";
    ctx.fillText("spin the rally, bank the angles", FIELD_CX, 258);
    this.drawMenu(game, TITLE_ITEMS);
  }

  private drawHowto(game: CaromGame): void {
    this.dim();
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.font = "800 48px Inter, system-ui, sans-serif";
    ctx.fillText("HOW TO PLAY", FIELD_CX, 145);
    ctx.font = "500 25px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(235,248,255,0.82)";
    const lines = [
      "W/S move the left paddle. Arrow keys move the right paddle in Versus.",
      "In Solo, either side of the keyboard moves player one.",
      "A moving paddle puts spin on contact, bending the ball after the hit.",
      "Use the center obstacles for bank shots. P pauses. M mutes.",
    ];
    lines.forEach((line, index) =>
      ctx.fillText(line, FIELD_CX, 245 + index * 48),
    );
    this.drawMenu(game, HOWTO_ITEMS);
  }

  private drawCountdown(game: CaromGame): void {
    const ball = game.state.ball;
    if (!ball) return;
    ctxText(
      this.ctx,
      Math.ceil(ball.holdTimer).toString(),
      FIELD_CX,
      FIELD_CY - 95,
      96,
    );
  }

  private drawPaused(game: CaromGame): void {
    this.dim();
    ctxText(this.ctx, "PAUSED", FIELD_CX, 280, 52);
    this.drawMenu(game, PAUSE_ITEMS);
  }

  private drawMatchover(game: CaromGame): void {
    this.dim();
    const state = game.state;
    const winner =
      state.winner === "left" ? "PLAYER ONE WINS" : "PLAYER TWO WINS";
    ctxText(this.ctx, winner, FIELD_CX, 230, 52);
    const ctx = this.ctx;
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(235,248,255,0.86)";
    ctx.textAlign = "center";
    ctx.fillText(`${state.score.p1} - ${state.score.p2}`, FIELD_CX, 295);
    this.drawMenu(game, MATCHOVER_ITEMS);
  }

  private drawMenu(game: CaromGame, items: readonly string[]): void {
    const ctx = this.ctx;
    items.forEach((item, index) => {
      const rect = game.menuItemRect(index) as MenuRect;
      const selected = game.state.menuIndex === index;
      roundedRect(
        ctx,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        8,
        selected ? "rgba(235,248,255,0.95)" : "rgba(235,248,255,0.11)",
        selected ? "rgba(255,240,106,0.48)" : "rgba(235,248,255,0.16)",
      );
      ctx.textAlign = "center";
      ctx.font = "800 26px Inter, system-ui, sans-serif";
      ctx.fillStyle = selected ? "#071016" : "rgba(235,248,255,0.88)";
      ctx.fillText(item, rect.x + rect.w / 2, rect.y + 38);
    });
  }

  private drawOverlay(game: CaromGame): void {
    const ctx = this.ctx;
    const lines = game.diagnostics();
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(18, 18, 520, 28 + lines.length * 22);
    ctx.fillStyle = "#b7fff0";
    ctx.font = "500 15px ui-monospace, Menlo, monospace";
    ctx.textAlign = "left";
    lines.forEach((line, index) => ctx.fillText(line, 34, 48 + index * 22));
  }

  private dim(): void {
    this.ctx.fillStyle = "rgba(7,16,22,0.68)";
    this.ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  shadow: string,
): void {
  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function ctxText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
): void {
  ctx.textAlign = "center";
  ctx.font = `900 ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(235,248,255,0.94)";
  ctx.fillText(text, x, y);
}
