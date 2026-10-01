import { SynthAudio } from "./audio";
import { CaromGame, EMPTY_INPUT } from "./core";
import { installDebugApi } from "./debug";
import { computeFit, InputSystem } from "./input";
import { Renderer } from "./renderer";

const canvas = document.querySelector<HTMLCanvasElement>("#stage");
if (!canvas) throw new Error("Missing #stage canvas");
const stage = canvas;

const audio = new SynthAudio();
const game = new CaromGame(audio);
const renderer = new Renderer(stage);
let overlay = false;
let fit = computeFit(stage);

const input = new InputSystem(
  stage,
  () => fit,
  () => {
    overlay = !overlay;
  },
);

function render(): void {
  fit = computeFit(stage);
  renderer.render(game, fit, overlay);
}

installDebugApi(game, render, () => input.consumeFrame());

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (game.isAutoStep()) game.update(dt, input.consumeFrame());
  else input.consumeFrame();
  render();
  requestAnimationFrame(frame);
}

game.update(0, EMPTY_INPUT);
render();
requestAnimationFrame(frame);
