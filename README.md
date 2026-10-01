# Carom

Carom is a top-down paddle duel for the browser. Two paddles face off across a
dark 16:9 field while one ball ricochets off the walls, the paddles, and two
fixed center obstacles. Paddle motion at contact adds spin, so rallies bend,
bank, and change shape after every clean hit.

The game runs entirely in the browser with no backend and no external runtime
assets. Graphics are drawn on a canvas, audio cues are synthesized in the
browser, and the production build is a static site.

## Install

```sh
npm ci
```

## Development

```sh
npm run dev
```

Vite serves the game with hot reload. Open the local URL it prints and play in
the browser.

## Production Build

```sh
npm run build
```

The static site is emitted to `dist/`, with `dist/index.html` as its entry
point. The directory can be served as-is from a static file server.

## Controls

- `W` / `S`: move player one's left paddle.
- `ArrowUp` / `ArrowDown`: move player two's right paddle in Versus.
- In Solo, either `W` / `S` or the arrow keys move player one.
- `Enter` or `Space`: confirm menu items.
- `Escape`: pause, resume, back, or quit from supported menus.
- `P`: pause or resume during a match.
- `M`: mute or unmute sound.
- Backtick: toggle the diagnostics overlay.

## Modes

Solo pits the left paddle against an AI-controlled right paddle. Versus lets two
local players share the keyboard. A match goes to 11 points with a two-point
lead.

