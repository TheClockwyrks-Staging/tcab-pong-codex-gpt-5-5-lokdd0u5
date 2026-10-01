export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

export function randomServeSign(): 1 | -1 {
  return Math.random() < 0.5 ? -1 : 1;
}
