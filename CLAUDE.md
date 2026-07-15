# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A vanilla JavaScript Tetris implementation using HTML5 Canvas. No dependencies, no build tools, no package.json, no test suite — the entire game lives in three files: `index.html`, `style.css`, `game.js`.

## Running the game

Just open `index.html` directly in a browser, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no build, lint, or test command — none is configured in this repo.

## Architecture

Everything is in `game.js` as top-level state and functions (no classes, no modules). Key pieces:

- **Board model**: `board` is a `ROWS × COLS` (20×10) matrix; each cell is `0` (empty) or a piece color index (1–7).
- **Pieces**: `PIECES` defines the 7 tetrominoes as square matrices. Rotation (`rotateCW`) transposes + reverses rows rather than using precomputed rotation states.
- **Collision** (`collide`): checks board bounds and overlap with locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns until a non-colliding position is found.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row once `dropInterval` is exceeded.
- **Line clearing** (`clearLines`): scans bottom-to-top, splices full rows out and unshifts empty rows at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/row dropped, soft drop adds 1 pt/row.
- **Leveling**: level increases every 10 lines; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.

Control flow: `init()` builds the board and starts the loop → `loop()` handles gravity and calls `draw()` each frame → `keydown` listener handles movement/rotation/drop/pause and is only active when not paused/game-over → `spawn()` promotes `next` to `current`, generates a new `next`, and triggers `endGame()` if the new piece immediately collides.

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, also update the `width`/`height` attributes of `<canvas id="board">` in `index.html` to match (`COLS × BLOCK` by `ROWS × BLOCK`).

The README (`README.md`) is written in Spanish and documents controls, scoring, and tunable constants in more detail.
