'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
const TSPIN_SCORES = [100, 200, 400, 600]; // bonus (antes de nivel) para T-Spin con 0, 1, 2 o 3 líneas
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000];
const EFFECT_COLORS = {
  combo: '#ffd54f',
  tetris: '#4dd0e1',
  tspin: '#ba68c8',
  b2b: '#ff8a65',
  perfect: '#81c784',
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboSection = document.getElementById('combo-section');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

const THEME_STORAGE_KEY = 'tetris-theme';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, b2bActive, lastMoveWasRotation, floatingTexts;
let audioCtx = null;

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function toggleTheme() {
  const activeTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  applyTheme(activeTheme === 'light' ? 'dark' : 'light');
}

themeToggleBtn.addEventListener('click', toggleTheme);
applyTheme(localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark');

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveWasRotation = true;
      return;
    }
  }
}

// Regla de las 3 esquinas: si la última acción fue una rotación de una pieza T
// y al menos 3 de las 4 esquinas de su caja 3x3 están ocupadas (o son pared/suelo), es T-spin.
function detectTSpin() {
  if (current.type !== 3 || !lastMoveWasRotation) return false;
  const corners = [
    [current.y, current.x],
    [current.y, current.x + 2],
    [current.y + 2, current.x],
    [current.y + 2, current.x + 2],
  ];
  let filled = 0;
  for (const [ry, rx] of corners) {
    if (rx < 0 || rx >= COLS || ry >= ROWS) filled++;
    else if (ry >= 0 && board[ry][rx]) filled++;
  }
  return filled >= 3;
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines(tspin) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }

  combo = cleared > 0 ? combo + 1 : 0;

  if (cleared === 0) {
    if (tspin) {
      score += TSPIN_SCORES[0] * level;
      queueEffect('T-SPIN', 'tspin');
      playSound('tspin');
      flashBoard();
      updateHUD();
    }
    return cleared;
  }

  const isTetris = cleared === 4;
  const qualifiesForB2B = isTetris || tspin;
  let base = (LINE_SCORES[cleared] || 0) * level;
  if (tspin) base += TSPIN_SCORES[cleared] * level;

  const comboMultiplier = Math.max(1, combo);
  let total = base * comboMultiplier;

  const isB2B = qualifiesForB2B && b2bActive;
  if (isB2B) total += Math.floor(base * 0.5);
  b2bActive = qualifiesForB2B;

  score += total;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);

  const effects = [];
  if (tspin) effects.push({ text: `T-SPIN ${LINE_NAMES[cleared]}`, type: 'tspin' });
  else if (isTetris) effects.push({ text: 'TETRIS', type: 'tetris' });
  if (isB2B) effects.push({ text: 'BACK-TO-BACK', type: 'b2b' });
  if (combo > 1) effects.push({ text: `COMBO x${combo}`, type: 'combo' });

  const isPerfectClear = board.every(row => row.every(v => v === 0));
  if (isPerfectClear) {
    score += PERFECT_CLEAR_SCORES[cleared] * level;
    effects.push({ text: 'PERFECT CLEAR!', type: 'perfect' });
  }

  effects.forEach((e, i) => queueEffect(e.text, e.type, i));

  const soundKind = isPerfectClear ? 'perfect'
    : isB2B ? 'b2b'
    : tspin ? 'tspin'
    : isTetris ? 'tetris'
    : combo > 1 ? 'combo'
    : 'clear';
  playSound(soundKind);
  if (isTetris || tspin || isB2B || isPerfectClear) flashBoard();

  updateHUD();
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = detectTSpin();
  merge();
  clearLines(tspin);
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  lastMoveWasRotation = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  if (combo > 1) {
    comboSection.style.display = '';
    comboEl.textContent = `x${combo}`;
  } else {
    comboSection.style.display = 'none';
  }
}

function queueEffect(text, type, row = 0) {
  floatingTexts.push({
    text,
    color: EFFECT_COLORS[type] || '#ffffff',
    created: performance.now(),
    duration: 1100,
    row,
  });
}

function drawEffects() {
  if (!floatingTexts.length) return;
  const now = performance.now();
  floatingTexts = floatingTexts.filter(f => now - f.created < f.duration);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px system-ui, sans-serif';
  floatingTexts.forEach(f => {
    const t = (now - f.created) / f.duration;
    ctx.globalAlpha = Math.max(1 - t, 0);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, canvas.width / 2, canvas.height / 2 - 10 - f.row * 26 - t * 30);
  });
  ctx.restore();
}

function flashBoard() {
  canvas.classList.remove('flash');
  void canvas.offsetWidth; // fuerza reflow para reiniciar la animación
  canvas.classList.add('flash');
}

function ensureAudioCtx() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(freq, duration = 0.12, type = 'sine', delay = 0, volume = 0.15) {
  const ctxA = ensureAudioCtx();
  if (!ctxA) return;
  const osc = ctxA.createOscillator();
  const gain = ctxA.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctxA.destination);
  const startTime = ctxA.currentTime + delay;
  osc.start(startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.stop(startTime + duration + 0.02);
}

function playSound(kind) {
  try {
    switch (kind) {
      case 'clear':
        beep(440, 0.12, 'sine');
        break;
      case 'combo':
        beep(440 + Math.min(combo, 10) * 55, 0.12, 'square');
        break;
      case 'tetris':
        [523, 659, 784, 988].forEach((f, i) => beep(f, 0.14, 'square', i * 0.06));
        break;
      case 'tspin':
        beep(660, 0.1, 'triangle');
        beep(880, 0.14, 'triangle', 0.09);
        break;
      case 'b2b':
        beep(784, 0.1, 'sawtooth');
        beep(988, 0.14, 'sawtooth', 0.08);
        break;
      case 'perfect':
        [523, 659, 784, 988, 1175].forEach((f, i) => beep(f, 0.16, 'sine', i * 0.09));
        break;
    }
  } catch (err) {
    // Web Audio no disponible; se ignora silenciosamente.
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawEffects();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver && !paused) animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  b2bActive = false;
  lastMoveWasRotation = false;
  floatingTexts = [];
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) {
        current.x--;
        lastMoveWasRotation = false;
      }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) {
        current.x++;
        lastMoveWasRotation = false;
      }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

init();
