"use strict";

/* ══════════════════════════════════════════════════════
   BATTLE OF MINDS — app.js
   Chess engine + war UI + fog + sound + animations
══════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

// ─── SOUND ENGINE (Web Audio API) ─────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null;

function getAudioCtx() {
  if (!actx) actx = new AudioCtx();
  return actx;
}

function playSound(type) {
  try {
    const ctx = getAudioCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.18, ctx.currentTime);
    master.connect(ctx.destination);

    if (type === "move") {
      // Metallic click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(master);
      osc.type = "square";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);

    } else if (type === "capture") {
      // Impact boom
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (data.length * 0.3));
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.6 - i * 0.15, ctx.currentTime + i * 0.04);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18 + i * 0.04);
        src.connect(g2); g2.connect(master);
        src.start(ctx.currentTime + i * 0.04);
      }

    } else if (type === "check") {
      // Rising alarm
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(master);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);

    } else if (type === "checkmate") {
      // War horn
      const freqs = [110, 138, 165, 220];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(master);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.6);
      });

    } else if (type === "select") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(master);
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06);
    }
  } catch (_) {}
}

// ─── FOG OF WAR (Canvas) ──────────────────────────────
(function initFog() {
  const canvas = $("fog-canvas");
  const ctx = canvas.getContext("2d");
  let W, H;
  const blobs = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // Create fog blobs
  for (let i = 0; i < 12; i++) {
    blobs.push({
      x: Math.random() * 1400, y: Math.random() * 900,
      r: 200 + Math.random() * 400,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.2,
      opacity: 0.03 + Math.random() * 0.05,
      color: Math.random() > 0.7 ? "139,0,0" : "20,20,30"
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    blobs.forEach(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.x < -b.r) b.x = W + b.r;
      if (b.x > W + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = H + b.r;
      if (b.y > H + b.r) b.y = -b.r;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(${b.color},${b.opacity})`);
      g.addColorStop(1, `rgba(${b.color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ─── PARTICLE BURSTS ──────────────────────────────────
function spawnParticles(x, y, count = 10, color = "#c0392b") {
  const root = $("particle-root");
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const dist  = 30 + Math.random() * 80;
    const tx    = Math.cos(angle) * dist;
    const ty    = Math.sin(angle) * dist;
    const size  = 3 + Math.random() * 5;
    p.style.cssText = `
      left:${x}px; top:${y}px;
      width:${size}px; height:${size}px;
      background:${color};
      box-shadow: 0 0 ${size * 2}px ${color};
      --tx:${tx}px; --ty:${ty}px;
      animation-duration:${0.4 + Math.random() * 0.4}s;
      animation-delay:${Math.random() * 0.1}s;
    `;
    root.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
  }
}

function getBoardSquareCenter(row, col) {
  const board = $("chess-board");
  const rect  = board.getBoundingClientRect();
  const sqW   = rect.width / 8;
  const sqH   = rect.height / 8;
  return {
    x: rect.left + col * sqW + sqW / 2,
    y: rect.top  + row * sqH + sqH / 2
  };
}

// ─── GAME STATE ───────────────────────────────────────
let game          = null;
let selectedSq    = null;
let validMoves    = {};
let lastFrom      = null;
let lastTo        = null;
let moveHistory   = [];
let timerMins     = 0;
let timerInterval = null;
let timers        = { white: 0, black: 0 };
let timersMax     = { white: 0, black: 0 };
let gameOver      = false;
let playerNames   = { white: "Commander I", black: "Commander II" };
let startTime     = null;
let totalMoves    = 0;

const PIECE_GLYPHS = {
  white: { K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘", P:"♙" },
  black: { K:"♚", Q:"♛", R:"♜", B:"♝", N:"♞", P:"♟" }
};
const PIECE_VALUES = { K:0, Q:9, R:5, B:3, N:3, P:1 };

// ─── BRIEFING SCREEN ──────────────────────────────────
let selectedMins = 0;

document.querySelectorAll(".timer-opt").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".timer-opt").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMins = parseInt(btn.dataset.mins);
  });
});

$("btn-deploy").addEventListener("click", () => {
  const wName = $("player-white").value.trim() || "Commander I";
  const bName = $("player-black").value.trim() || "Commander II";
  playerNames = { white: wName.toUpperCase(), black: bName.toUpperCase() };
  timerMins = selectedMins;
  deployBattle();
});

function deployBattle() {
  getAudioCtx(); // Unlock audio on user gesture
  $("white-name").textContent = playerNames.white;
  $("black-name").textContent = playerNames.black;

  // Setup timers
  if (timerMins > 0) {
    timers.white = timers.black = timerMins * 60;
    timersMax.white = timersMax.black = timerMins * 60;
    updateTimerDisplay("white");
    updateTimerDisplay("black");
  } else {
    $("white-time").textContent = "∞";
    $("black-time").textContent = "∞";
  }

  startTime = Date.now();
  game = new ChessGame();
  selectedSq = null;
  validMoves = {};
  lastFrom = lastTo = null;
  moveHistory = [];
  gameOver = false;
  totalMoves = 0;

  $("log-entries").innerHTML = "";
  $("log-count").textContent = "0 MOVES";
  $("move-counter").textContent = "0";
  $("white-cap-list").innerHTML = "";
  $("black-cap-list").innerHTML = "";
  $("white-material").textContent = "";
  $("black-material").textContent = "";
  $("eval-fill").style.width = "50%";
  $("eval-num").textContent = "=";

  renderBoard();
  updateHUD();
  switchScreen("screen-battle");
  startTimer();
}

$("btn-abort").addEventListener("click", () => {
  stopTimer();
  switchScreen("screen-briefing");
});

// ─── SCREEN TRANSITIONS ───────────────────────────────
function switchScreen(id) {
  const current = document.querySelector(".screen.active");
  if (current) {
    current.classList.add("fade-out");
    setTimeout(() => { current.classList.remove("active", "fade-out"); }, 450);
  }
  setTimeout(() => { $(id).classList.add("active"); }, 200);
}

// ─── TIMER ────────────────────────────────────────────
function startTimer() {
  stopTimer();
  if (timerMins === 0) return;
  timerInterval = setInterval(() => {
    if (gameOver) { stopTimer(); return; }
    const side = game.turn;
    timers[side]--;
    updateTimerDisplay(side);
    if (timers[side] <= 0) {
      stopTimer();
      endGame(side === "white" ? "black" : "white", "time");
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateTimerDisplay(side) {
  if (timerMins === 0) return;
  const t = Math.max(0, timers[side]);
  const m = String(Math.floor(t / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  const el = $(`${side}-time`);
  const bar = $(`${side}-timer-bar`);
  const pct = t / timersMax[side] * 100;
  el.textContent = `${m}:${s}`;
  bar.style.width = `${pct}%`;

  // Active styling
  const isActive = game.turn === side;
  el.classList.toggle("active-timer", isActive);
  bar.classList.toggle("active-bar", isActive);
  bar.classList.toggle("danger", t < 30);
}

// ─── BOARD RENDER ─────────────────────────────────────
function renderBoard() {
  const board = $("chess-board");
  board.innerHTML = "";

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      const sq = document.createElement("div");
      sq.className = `square ${isLight ? "light" : "dark"}`;
      sq.dataset.row = r; sq.dataset.col = c;

      if (lastFrom && lastFrom.row === r && lastFrom.col === c) sq.classList.add("last-move-from");
      if (lastTo   && lastTo.row   === r && lastTo.col   === c) sq.classList.add("last-move-to");
      if (selectedSq && selectedSq.row === r && selectedSq.col === c) sq.classList.add("selected");

      const key = `${r},${c}`;
      if (validMoves[key] !== undefined) {
        const target = game.board[r][c];
        sq.classList.add(target ? "valid-capture" : "valid-move");
      }

      if (game.isInCheck()) {
        const k = game.findKing(game.turn);
        if (k && k.row === r && k.col === c) sq.classList.add("in-check");
      }

      const piece = game.board[r][c];
      if (piece) {
        const span = document.createElement("span");
        span.className = `piece ${piece.color}`;
        span.textContent = PIECE_GLYPHS[piece.color][piece.type];
        sq.appendChild(span);
      }

      sq.addEventListener("click", () => onSquareClick(r, c));
      board.appendChild(sq);
    }
  }

  buildCoords();
}

function buildCoords() {
  const rl = $("rank-l"), rr = $("rank-r"), fb = $("file-b");
  if (!rl) return;
  rl.innerHTML = rr.innerHTML = fb.innerHTML = "";
  const ranks = ["8","7","6","5","4","3","2","1"];
  const files = ["a","b","c","d","e","f","g","h"];
  ranks.forEach(r => {
    [rl, rr].forEach(el => {
      const s = document.createElement("span"); s.className = "coord-lbl"; s.textContent = r;
      el.appendChild(s);
    });
  });
  files.forEach(f => {
    const s = document.createElement("span"); s.className = "coord-lbl"; s.textContent = f;
    fb.appendChild(s);
  });
}

// ─── HUD UPDATE ───────────────────────────────────────
function updateHUD() {
  const isWhite = game.turn === "white";
  const inCheck = game.isInCheck();

  // Turn text
  const name = isWhite ? playerNames.white : playerNames.black;
  $("turn-text").textContent = inCheck
    ? `${name} — UNDER FIRE`
    : `${name}'s COMMAND`;

  // Threat dots
  const threatLevel = getThreatLevel();
  [1,2,3,4,5].forEach(i => {
    $(`td${i}`).classList.toggle("active", i <= threatLevel);
  });

  // Timer active state
  if (timerMins > 0) {
    updateTimerDisplay("white");
    updateTimerDisplay("black");
  }

  // Alert banner
  const banner = $("alert-banner");
  if (game.isCheckmate()) {
    banner.classList.remove("hidden");
    $("alert-text").textContent = "CHECKMATE";
  } else if (game.isStalemate()) {
    banner.classList.remove("hidden");
    $("alert-text").textContent = "STALEMATE";
  } else if (inCheck) {
    banner.classList.remove("hidden");
    $("alert-text").textContent = "CHECK — KING EXPOSED";
  } else {
    banner.classList.add("hidden");
  }

  // Eval bar
  updateEvalBar();
  updateTimerActiveStyles();
}

function updateTimerActiveStyles() {
  const wt = $("white-time"), bt = $("black-time");
  const wb = $("white-timer-bar"), bb = $("black-timer-bar");
  if (timerMins === 0) return;
  const isWhite = game.turn === "white";
  wt.classList.toggle("active-timer", isWhite);
  bt.classList.toggle("active-timer", !isWhite);
  wb.classList.toggle("active-bar", isWhite);
  bb.classList.toggle("active-bar", !isWhite);
}

function getThreatLevel() {
  // Rough heuristic: # legal moves available
  const moves = game.getAllLegalMoves(game.turn).length;
  if (game.isCheckmate() || game.isStalemate()) return 5;
  if (game.isInCheck()) return 4;
  if (moves < 10) return 3;
  if (moves < 20) return 2;
  return 1;
}

function updateEvalBar() {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (!p) continue;
      const v = PIECE_VALUES[p.type];
      score += p.color === "white" ? v : -v;
    }
  }
  // Map score [-20..20] to fill pct [0..100] (50 = equal, <50 = black advantage)
  const clamped = Math.max(-20, Math.min(20, score));
  const pct = 50 - (clamped / 20) * 50;
  $("eval-fill").style.width = `${pct}%`;
  $("eval-num").textContent = score === 0 ? "=" : (score > 0 ? `+${score}` : `${score}`);

  // Material advantage display
  updateMaterialDisplay();
}

function updateMaterialDisplay() {
  const captured = { white: [], black: [] };
  // Determine what was captured
  // Starting counts
  const START = { K:1, Q:1, R:2, B:2, N:2, P:8 };
  const cur = { white: {K:0,Q:0,R:0,B:0,N:0,P:0}, black: {K:0,Q:0,R:0,B:0,N:0,P:0} };
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (game.board[r][c]) cur[game.board[r][c].color][game.board[r][c].type]++;

  let wMat = 0, bMat = 0;
  for (const [type, count] of Object.entries(START)) {
    const wMissing = count - (cur.white[type] || 0);
    const bMissing = count - (cur.black[type] || 0);
    for (let i = 0; i < wMissing; i++) captured.black.push({ type, color: "white" });
    for (let i = 0; i < bMissing; i++) captured.white.push({ type, color: "black" });
    wMat += (bMissing) * PIECE_VALUES[type];
    bMat += (wMissing) * PIECE_VALUES[type];
  }

  const renderCap = (side, list) => {
    const el = $(`${side}-cap-list`);
    const matEl = $(`${side}-material`);
    el.innerHTML = list.map(p => `<span title="${p.type}">${PIECE_GLYPHS[p.color][p.type]}</span>`).join("");
    const adv = side === "white" ? wMat - bMat : bMat - wMat;
    matEl.textContent = adv > 0 ? `+${adv}` : "";
  };
  renderCap("white", captured.white);
  renderCap("black", captured.black);
}

// ─── CLICK TO MOVE ────────────────────────────────────
function onSquareClick(row, col) {
  if (gameOver) return;

  const piece = game.board[row][col];
  const key   = `${row},${col}`;

  if (selectedSq) {
    if (validMoves[key] !== undefined) {
      executeMove(selectedSq.row, selectedSq.col, row, col);
      return;
    }
    if (piece && piece.color === game.turn) {
      playSound("select");
      selectedSq = { row, col };
      computeValidMoves(row, col);
      renderBoard();
      return;
    }
    selectedSq = null; validMoves = {};
    renderBoard(); return;
  }

  if (!piece || piece.color !== game.turn) return;
  playSound("select");
  selectedSq = { row, col };
  computeValidMoves(row, col);
  renderBoard();
}

function computeValidMoves(row, col) {
  validMoves = {};
  game.getLegalMoves(row, col).forEach(m => { validMoves[`${m.row},${m.col}`] = m; });
}

async function executeMove(fr, fc, tr, tc) {
  const piece = game.board[fr][fc];
  let promo = null;

  if (piece?.type === "P" && ((piece.color === "white" && tr === 0) || (piece.color === "black" && tr === 7))) {
    promo = await showPromotion(piece.color);
  }

  const wasCapture = !!game.board[tr][tc];
  const result = game.makeMove(fr, fc, tr, tc, promo);
  if (!result) return;

  totalMoves++;
  $("move-counter").textContent = Math.ceil(totalMoves / 2);

  // Particle burst on capture
  if (wasCapture) {
    const center = getBoardSquareCenter(tr, tc);
    spawnParticles(center.x, center.y, 18, "#c0392b");
    playSound("capture");
  } else {
    playSound("move");
  }

  lastFrom = { row: fr, col: fc };
  lastTo   = { row: tr, col: tc };
  selectedSq = null; validMoves = {};

  // Add piece move animation
  renderBoard();

  const targetSq = $("chess-board").querySelector(`[data-row="${tr}"][data-col="${tc}"]`);
  const pieceEl  = targetSq?.querySelector(".piece");
  if (pieceEl) pieceEl.classList.add("moving");

  recordMoveLog(result.notation, wasCapture);
  updateHUD();

  // Check sound
  if (game.isInCheck()) {
    setTimeout(() => playSound(game.isCheckmate() ? "checkmate" : "check"), 100);
  }

  // Game over check
  if (game.isCheckmate()) {
    setTimeout(() => endGame(game.turn === "white" ? "black" : "white", "checkmate"), 600);
  } else if (game.isStalemate()) {
    setTimeout(() => endGame(null, "stalemate"), 400);
  }
}

function showPromotion(color) {
  return new Promise(resolve => {
    const panel   = $("promo-panel");
    const choices = $("promo-choices");
    choices.innerHTML = "";
    ["Q","R","B","N"].forEach(type => {
      const btn = document.createElement("button");
      btn.className = "promo-btn";
      btn.textContent = PIECE_GLYPHS[color][type];
      btn.style.color = color === "white" ? "#f5f0e8" : "#0d0d0d";
      btn.addEventListener("click", () => {
        panel.classList.add("hidden");
        resolve(type);
      });
      choices.appendChild(btn);
    });
    panel.classList.remove("hidden");
  });
}

// ─── MOVE LOG ─────────────────────────────────────────
function recordMoveLog(notation, isCapture) {
  const moveNum = Math.ceil(totalMoves / 2);
  const isWhite = totalMoves % 2 === 1;
  const list    = $("log-entries");

  // Remove 'latest' from all
  list.querySelectorAll(".log-move.latest").forEach(e => e.classList.remove("latest"));

  if (isWhite) {
    const pair = document.createElement("div");
    pair.className = "log-pair";
    pair.dataset.move = moveNum;
    pair.innerHTML = `
      <span class="log-num">${moveNum}</span>
      <span class="log-move latest ${isCapture ? "capture-move" : ""}" data-side="white">${notation}</span>
      <span class="log-move" data-side="black">…</span>`;
    list.appendChild(pair);
  } else {
    const last = list.querySelector(`[data-move="${moveNum}"] [data-side="black"]`);
    if (last) {
      last.textContent = notation;
      last.classList.add("latest");
      if (isCapture) last.classList.add("capture-move");
    }
  }

  const count = Math.ceil(totalMoves / 2);
  $("log-count").textContent = `${totalMoves} MOVES`;
  list.scrollTop = list.scrollHeight;
}

// ─── GAME OVER ────────────────────────────────────────
function endGame(winner, reason) {
  stopTimer();
  gameOver = true;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const emblem = $("debrief-emblem");
  const title  = $("debrief-title");
  const body   = $("debrief-body");
  const stats  = $("debrief-stats");

  title.className = "debrief-title";

  if (reason === "stalemate" || !winner) {
    emblem.textContent = "⚖";
    title.textContent = "STALEMATE";
    title.classList.add("draw");
    body.textContent  = "Neither commander achieved dominance. A tactical deadlock.";
  } else {
    const winnerName = playerNames[winner];
    if (reason === "checkmate") {
      emblem.textContent = winner === "white" ? "♔" : "♚";
      title.textContent = "VICTORY";
      body.textContent  = `${winnerName} executed a decisive checkmate. The battlefield is theirs.`;
    } else if (reason === "time") {
      emblem.textContent = "⏱";
      title.textContent = "TIME EXPIRED";
      body.textContent  = `${winnerName} wins on time. The clock is a weapon too.`;
    }
  }

  stats.innerHTML = `
    <div class="stat-item"><div class="stat-val">${totalMoves}</div><div class="stat-label">TOTAL MOVES</div></div>
    <div class="stat-item"><div class="stat-val">${mm}:${ss}</div><div class="stat-label">DURATION</div></div>
    <div class="stat-item"><div class="stat-val">${Math.ceil(totalMoves/2)}</div><div class="stat-label">FULL TURNS</div></div>
  `;

  setTimeout(() => switchScreen("screen-debrief"), 800);
}

$("btn-rematch").addEventListener("click", () => {
  deployBattle();
});
$("btn-newmission").addEventListener("click", () => {
  switchScreen("screen-briefing");
});

// ─── CHESS ENGINE ─────────────────────────────────────
class ChessGame {
  constructor() {
    this.board     = this._init();
    this.turn      = "white";
    this.castling  = { white: { k: true, q: true }, black: { k: true, q: true } };
    this.enPassant = null;
    this.halfMove  = 0;
  }

  _init() {
    const b    = Array.from({ length: 8 }, () => Array(8).fill(null));
    const back = ["R","N","B","Q","K","B","N","R"];
    back.forEach((t, c) => {
      b[0][c] = { type: t, color: "black" };
      b[7][c] = { type: t, color: "white" };
    });
    for (let c = 0; c < 8; c++) {
      b[1][c] = { type: "P", color: "black" };
      b[6][c] = { type: "P", color: "white" };
    }
    return b;
  }

  findKing(color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]?.type === "K" && this.board[r][c]?.color === color)
          return { row: r, col: c };
    return null;
  }

  isSquareAttacked(row, col, byColor) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p?.color !== byColor) continue;
        if (this._raw(r, c, true).some(m => m.row === row && m.col === col)) return true;
      }
    return false;
  }

  isInCheck(color) {
    color = color || this.turn;
    const k = this.findKing(color);
    if (!k) return false;
    return this.isSquareAttacked(k.row, k.col, color === "white" ? "black" : "white");
  }

  _raw(row, col, attackOnly = false) {
    const p = this.board[row][col];
    if (!p) return [];
    const { type, color } = p;
    const opp = color === "white" ? "black" : "white";
    const dir = color === "white" ? -1 : 1;
    const moves = [];

    const addIf = (r, c) => {
      if (r < 0 || r > 7 || c < 0 || c > 7) return;
      const t = this.board[r][c];
      if (t?.color === color) return;
      moves.push({ row: r, col: c });
    };

    const slide = (dr, dc) => {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const t = this.board[r][c];
        if (t) { if (t.color !== color) moves.push({ row: r, col: c }); break; }
        moves.push({ row: r, col: c });
        r += dr; c += dc;
      }
    };

    switch (type) {
      case "P": {
        if (!attackOnly) {
          const r1 = row + dir;
          if (r1 >= 0 && r1 < 8 && !this.board[r1][col]) moves.push({ row: r1, col });
          const start = color === "white" ? 6 : 1;
          const r2 = row + 2 * dir;
          if (row === start && !this.board[row+dir][col] && !this.board[r2][col]) moves.push({ row: r2, col });
        }
        [-1,1].forEach(dc => {
          const r = row + dir, c = col + dc;
          if (r < 0 || r > 7 || c < 0 || c > 7) return;
          const t = this.board[r][c];
          if (t?.color === opp) moves.push({ row: r, col: c });
          else if (attackOnly && !t) moves.push({ row: r, col: c });
          if (!attackOnly && this.enPassant?.row === r && this.enPassant?.col === c)
            moves.push({ row: r, col: c, enPassant: true });
        });
        break;
      }
      case "N":
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => addIf(row+dr,col+dc));
        break;
      case "B": [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => slide(dr,dc)); break;
      case "R": [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); break;
      case "Q": [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); break;
      case "K":
        [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => addIf(row+dr,col+dc));
        if (!attackOnly) {
          const cs = this.castling[color];
          const oppColor = opp;
          if (cs.k && !this.board[row][col+1] && !this.board[row][col+2] &&
              !this.isSquareAttacked(row,col,oppColor) && !this.isSquareAttacked(row,col+1,oppColor) && !this.isSquareAttacked(row,col+2,oppColor))
            moves.push({ row, col: col+2, castle: "k" });
          if (cs.q && !this.board[row][col-1] && !this.board[row][col-2] && !this.board[row][col-3] &&
              !this.isSquareAttacked(row,col,oppColor) && !this.isSquareAttacked(row,col-1,oppColor) && !this.isSquareAttacked(row,col-2,oppColor))
            moves.push({ row, col: col-2, castle: "q" });
        }
        break;
    }
    return moves;
  }

  getLegalMoves(row, col) {
    const p = this.board[row][col];
    if (!p || p.color !== this.turn) return [];
    return this._raw(row, col).filter(m => {
      const savedTarget = this.board[m.row][m.col];
      const savedEP     = this.enPassant;
      this.board[m.row][m.col] = p;
      this.board[row][col] = null;
      let epCap = null;
      if (m.enPassant) {
        const d = p.color === "white" ? 1 : -1;
        epCap = this.board[m.row+d][m.col];
        this.board[m.row+d][m.col] = null;
      }
      const legal = !this.isInCheck(p.color);
      this.board[row][col] = p;
      this.board[m.row][m.col] = savedTarget;
      if (m.enPassant) {
        const d = p.color === "white" ? 1 : -1;
        this.board[m.row+d][m.col] = epCap;
      }
      this.enPassant = savedEP;
      return legal;
    });
  }

  getAllLegalMoves(color) {
    const all = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p?.color === color) all.push(...this.getLegalMoves(r, c));
      }
    return all;
  }

  makeMove(fr, fc, tr, tc, promo = "Q") {
    const p = this.board[fr][fc];
    if (!p || p.color !== this.turn) return null;
    const legal = this.getLegalMoves(fr, fc);
    const mv = legal.find(m => m.row === tr && m.col === tc);
    if (!mv) return null;

    const captured = this.board[tr][tc];
    const notation = this._notation(fr, fc, tr, tc, p, captured, mv, promo);

    this.board[tr][tc] = p;
    this.board[fr][fc] = null;

    if (mv.enPassant) {
      const d = p.color === "white" ? 1 : -1;
      this.board[tr+d][tc] = null;
    }
    if (p.type === "P" && (tr === 0 || tr === 7)) {
      this.board[tr][tc] = { type: promo || "Q", color: p.color };
    }
    if (mv.castle) {
      if (mv.castle === "k") { this.board[tr][tc-1] = this.board[tr][7]; this.board[tr][7] = null; }
      else                   { this.board[tr][tc+1] = this.board[tr][0]; this.board[tr][0] = null; }
    }
    if (p.type === "K") this.castling[p.color] = { k: false, q: false };
    if (p.type === "R") {
      if (fc === 7) this.castling[p.color].k = false;
      if (fc === 0) this.castling[p.color].q = false;
    }
    this.enPassant = (p.type === "P" && Math.abs(tr-fr) === 2)
      ? { row: (fr+tr)/2, col: fc } : null;

    this.turn = this.turn === "white" ? "black" : "white";
    return { notation, captured, move: mv };
  }

  _notation(fr, fc, tr, tc, p, captured, mv, promo) {
    if (mv.castle) return mv.castle === "k" ? "O-O" : "O-O-O";
    const toAlg = r => String.fromCharCode(97+r[1]) + (8-r[0]);
    let n = "";
    if (p.type !== "P") n += p.type;
    else if (captured || mv.enPassant) n += String.fromCharCode(97+fc);
    if (captured || mv.enPassant) n += "x";
    n += String.fromCharCode(97+tc) + (8-tr);
    if (p.type === "P" && (tr === 0 || tr === 7)) n += "=" + (promo || "Q");
    return n;
  }

  isCheckmate() { return this.isInCheck() && this.getAllLegalMoves(this.turn).length === 0; }
  isStalemate() { return !this.isInCheck() && this.getAllLegalMoves(this.turn).length === 0; }
}
