"use strict";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE_URL = "https://adolfo-blondish-sublaryngeally.ngrok-free.dev";
const API      = `${BASE_URL}/api`;
const WS_URL   = BASE_URL.replace(/^https/, "wss").replace(/^http/, "ws");

// ─── GLOBALS ──────────────────────────────────────────────────────────────────
let ws            = null;
let currentRoom   = null;
let myUsername    = null;
let myRating      = null;
let myColor       = null;       // 'white' | 'black'
let gameState     = null;       // ChessGame instance
let selectedSq    = null;       // {row, col}
let validMovesMap = {};         // "r,c" -> [{row,col,type}]
let lastMove      = null;       // {from, to}
let moveHistory   = [];         // [ {white:"e4", black:"e5"}, ... ]
let isGameActive  = false;

// ─── UTILS ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
}

function showToast(msg, duration = 2800) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.classList.add("hidden"), 300);
  }, duration);
}

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
$("tab-btn") // tab switching
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

$("login-btn").addEventListener("click", async () => {
  const username = $("login-username").value.trim();
  const password = $("login-password").value;
  const errEl = $("login-error");
  errEl.classList.add("hidden");
  if (!username || !password) { errEl.textContent = "Fill in all fields."; errEl.classList.remove("hidden"); return; }
  try {
    const data = await apiFetch("/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    const token = data.token || data.jwt || (data.data && data.data.token);
    if (!token) throw new Error("No token in response");
    localStorage.setItem("token", token);
    await loadDashboard();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  }
});

$("register-btn").addEventListener("click", async () => {
  const username = $("reg-username").value.trim();
  const password = $("reg-password").value;
  const errEl = $("register-error");
  errEl.classList.add("hidden");
  if (!username || !password) { errEl.textContent = "Fill in all fields."; errEl.classList.remove("hidden"); return; }
  try {
    const data = await apiFetch("/register", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    const token = data.token || data.jwt || (data.data && data.data.token);
    if (!token) throw new Error("No token in response");
    localStorage.setItem("token", token);
    await loadDashboard();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  }
});

$("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("token");
  disconnectWS();
  showScreen("auth-screen");
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const profile = await apiFetch("/profile");
    myUsername = profile.username || profile.data?.username || profile.user?.username;
    myRating   = profile.rating   || profile.data?.rating   || profile.user?.rating || 1200;
    $("dash-username").textContent = myUsername;
    $("dash-rating").textContent   = `★ ${myRating}`;
    showScreen("dashboard-screen");
    connectWS();
    loadRooms();
    loadLeaderboard();
  } catch (e) {
    localStorage.removeItem("token");
    showScreen("auth-screen");
  }
}

// Dashboard tabs
document.querySelectorAll(".dash-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".dash-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".dash-tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $(`dtab-${btn.dataset.dtab}`).classList.add("active");
    if (btn.dataset.dtab === "leaderboard") loadLeaderboard();
  });
});

async function loadRooms() {
  const list = $("rooms-list");
  list.innerHTML = `<div class="loading-state">Loading rooms…</div>`;
  try {
    const data = await apiFetch("/rooms");
    const rooms = data.rooms || data.data || data || [];
    if (!rooms.length) { list.innerHTML = `<div class="loading-state">No rooms available. Create one!</div>`; return; }
    list.innerHTML = "";
    rooms.forEach(room => {
      const card = document.createElement("div");
      card.className = "room-card";
      const id   = room.id || room.room_id || room.code || "—";
      const host = room.host || room.creator || room.owner || "Unknown";
      const players = room.players || room.player_count || 0;
      card.innerHTML = `
        <div class="room-info">
          <span class="room-id">${id}</span>
          <span class="room-host">Host: ${host}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span class="room-players">${players}/2</span>
          ${players < 2 ? `<button class="btn-join-room" data-room="${id}">Join</button>` : `<span style="color:var(--text-muted);font-family:var(--font-mono);font-size:12px">Full</span>`}
        </div>`;
      list.appendChild(card);
    });
    list.querySelectorAll(".btn-join-room").forEach(btn => {
      btn.addEventListener("click", () => joinRoom(btn.dataset.room));
    });
  } catch(e) {
    list.innerHTML = `<div class="loading-state">Failed to load rooms.</div>`;
  }
}

async function loadLeaderboard() {
  const list = $("leaderboard-list");
  list.innerHTML = `<div class="loading-state">Loading…</div>`;
  try {
    const data = await apiFetch("/leaderboard");
    const entries = data.leaderboard || data.data || data || [];
    if (!entries.length) { list.innerHTML = `<div class="loading-state">No data yet.</div>`; return; }
    list.innerHTML = "";
    entries.slice(0,20).forEach((entry, i) => {
      const name   = entry.username || entry.name || entry.user || "—";
      const rating = entry.rating   || entry.elo  || entry.score || "—";
      const row = document.createElement("div");
      row.className = "lb-row";
      row.innerHTML = `
        <span class="lb-rank">${i === 0 ? "♛" : i === 1 ? "♜" : i === 2 ? "♝" : `#${i+1}`}</span>
        <span class="lb-name">${name}</span>
        <span class="lb-rating">${rating}</span>`;
      list.appendChild(row);
    });
  } catch(e) {
    list.innerHTML = `<div class="loading-state">Failed to load leaderboard.</div>`;
  }
}

$("refresh-rooms-btn").addEventListener("click", loadRooms);

$("create-room-btn").addEventListener("click", async () => {
  try {
    const data = await apiFetch("/room/create", { method: "POST", body: JSON.stringify({}) });
    const roomId = data.room_id || data.id || data.code || data.data?.room_id;
    if (!roomId) throw new Error("No room ID returned");
    showToast(`Room created: ${roomId}`);
    enterGame(roomId);
  } catch(e) { showToast(`Error: ${e.message}`); }
});

$("join-room-btn").addEventListener("click", () => {
  const code = $("join-code-input").value.trim().toUpperCase();
  if (!code) { showToast("Enter a room code"); return; }
  joinRoom(code);
});

function joinRoom(code) {
  enterGame(code);
}

// ─── GAME ENTRY ───────────────────────────────────────────────────────────────
function enterGame(roomId) {
  currentRoom = roomId;
  gameState   = new ChessGame();
  selectedSq  = null;
  validMovesMap = {};
  lastMove    = null;
  moveHistory = [];
  isGameActive = false;
  myColor     = null;

  $("game-room-label").textContent = `Room: ${roomId}`;
  $("self-name").textContent       = myUsername;
  $("self-rating-game").textContent = `★ ${myRating}`;
  $("opponent-name").textContent   = "Waiting for opponent…";
  $("opponent-rating").textContent = "";
  $("status-text").textContent     = "Waiting for opponent…";
  $("chat-messages").innerHTML     = "";
  $("moves-list").innerHTML        = "";
  $("game-status").className       = "game-status";

  renderBoard();
  showScreen("game-screen");

  // Tell server we're joining this room via WS
  wsSend({ type: "join", room_id: roomId, room: roomId });
}

$("leave-game-btn").addEventListener("click", () => {
  if (currentRoom) wsSend({ type: "leave", room_id: currentRoom });
  currentRoom = null;
  isGameActive = false;
  loadDashboard();
  showScreen("dashboard-screen");
});

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
function connectWS() {
  if (ws && ws.readyState < 2) return;
  const token = localStorage.getItem("token");
  ws = new WebSocket(`${WS_URL}?token=${token}`);

  ws.onopen = () => {
    $("connection-dot").className = "connection-dot connected";
    $("connection-dot").title = "Connected";
  };
  ws.onclose = () => {
    $("connection-dot").className = "connection-dot disconnected";
    $("connection-dot").title = "Disconnected";
    // Reconnect after 3s if we have a token
    if (localStorage.getItem("token")) setTimeout(connectWS, 3000);
  };
  ws.onerror = () => {
    $("connection-dot").className = "connection-dot disconnected";
  };
  ws.onmessage = e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handleWSMessage(msg);
  };
}

function disconnectWS() {
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
}

function wsSend(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function handleWSMessage(msg) {
  const type = msg.type || msg.event;
  switch(type) {
    case "joined":
    case "room_joined": {
      // Server confirms we joined; assigns color
      myColor = msg.color || msg.side || (msg.data?.color);
      if (!myColor) {
        // Guess: if we're the first player, white; else black
        myColor = msg.player_count === 1 || msg.players?.length === 1 ? "white" : "black";
      }
      if (msg.opponent || msg.data?.opponent) {
        const opp = msg.opponent || msg.data.opponent;
        $("opponent-name").textContent   = opp.username || opp;
        $("opponent-rating").textContent = opp.rating ? `★ ${opp.rating}` : "";
      }
      addSystemChat(`Joined room as ${myColor}`);
      renderBoard();
      break;
    }
    case "player_joined": {
      const opp = msg.player || msg.user || msg.data?.player || {};
      const oppName   = opp.username || opp.name || opp || "Opponent";
      const oppRating = opp.rating || "";
      $("opponent-name").textContent   = oppName;
      $("opponent-rating").textContent = oppRating ? `★ ${oppRating}` : "";
      isGameActive = true;
      updateStatusBar();
      addSystemChat(`${oppName} joined. Game starts!`);
      // If we don't have a color yet, assign
      if (!myColor) myColor = "white";
      renderBoard();
      break;
    }
    case "player_left": {
      const who = msg.player || msg.user || "Opponent";
      addSystemChat(`${who} left the game.`);
      isGameActive = false;
      $("status-text").textContent = "Opponent left";
      break;
    }
    case "move": {
      const from = msg.from || msg.data?.from;
      const to   = msg.to   || msg.data?.to;
      const promotion = msg.promotion || msg.data?.promotion;
      if (from && to) {
        const fromSq = algebraicToSquare(from);
        const toSq   = algebraicToSquare(to);
        if (fromSq && toSq) {
          const moveResult = gameState.makeMove(fromSq.row, fromSq.col, toSq.row, toSq.col, promotion);
          if (moveResult) {
            lastMove = { from: fromSq, to: toSq };
            recordMove(moveResult.notation, from, to);
            renderBoard();
            updateStatusBar();
          }
        }
      }
      break;
    }
    case "chat": {
      const author = msg.username || msg.from || msg.user || "?";
      const text   = msg.message  || msg.text || msg.content || "";
      addChatMsg(author, text, author === myUsername);
      break;
    }
    case "game_over":
    case "gameover": {
      isGameActive = false;
      const result = msg.result || msg.winner || msg.data?.result || "ended";
      const reason = msg.reason || msg.data?.reason || "";
      showGameOver(result, reason);
      break;
    }
    case "start":
    case "game_start": {
      isGameActive = true;
      myColor = msg.color || msg.side || msg.data?.color || myColor || "white";
      const opp = msg.opponent || msg.data?.opponent;
      if (opp) {
        $("opponent-name").textContent   = opp.username || opp;
        $("opponent-rating").textContent = opp.rating ? `★ ${opp.rating}` : "";
      }
      addSystemChat("Game started!");
      renderBoard();
      updateStatusBar();
      break;
    }
    case "error": {
      showToast(msg.message || msg.error || "Server error");
      break;
    }
  }
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────
function addChatMsg(author, text, isSelf) {
  const box   = $("chat-messages");
  const div   = document.createElement("div");
  div.className = `chat-msg ${isSelf ? "self-msg" : ""}`;
  div.innerHTML = `<span class="chat-msg-author ${isSelf ? "self" : ""}">${author}</span>
    <span class="chat-msg-text">${escapeHtml(text)}</span>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function addSystemChat(text) {
  const box = $("chat-messages");
  const div = document.createElement("div");
  div.className = "chat-msg system-msg";
  div.innerHTML = `<span class="chat-msg-text">${escapeHtml(text)}</span>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

$("chat-send-btn").addEventListener("click", sendChat);
$("chat-input").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

function sendChat() {
  const input = $("chat-input");
  const text  = input.value.trim();
  if (!text || !currentRoom) return;
  wsSend({ type: "chat", room_id: currentRoom, message: text, text });
  addChatMsg(myUsername, text, true);
  input.value = "";
}

// ─── MOVE HISTORY ─────────────────────────────────────────────────────────────
function recordMove(notation, from, to) {
  const lastPair = moveHistory[moveHistory.length - 1];
  if (!lastPair || lastPair.black !== undefined) {
    moveHistory.push({ white: notation });
  } else {
    lastPair.black = notation;
  }
  renderMoveHistory();
}

function renderMoveHistory() {
  const list = $("moves-list");
  list.innerHTML = "";
  moveHistory.forEach((pair, i) => {
    const div = document.createElement("div");
    div.className = "move-pair";
    const isLastPair = i === moveHistory.length - 1;
    div.innerHTML = `
      <span class="move-num">${i+1}.</span>
      <span class="move-notation ${isLastPair && !pair.black ? "latest" : ""}">${pair.white}</span>
      ${pair.black !== undefined ? `<span class="move-notation ${isLastPair ? "latest" : ""}">${pair.black}</span>` : ""}`;
    list.appendChild(div);
  });
  list.scrollTop = list.scrollHeight;
}

// ─── BOARD RENDERING ──────────────────────────────────────────────────────────
const PIECE_UNICODE = {
  white: { K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘", P:"♙" },
  black: { K:"♚", Q:"♛", R:"♜", B:"♝", N:"♞", P:"♟" }
};

function renderBoard() {
  const board = $("chess-board");
  board.innerHTML = "";

  // Determine display orientation
  const flip = myColor === "black";

  for (let displayRow = 0; displayRow < 8; displayRow++) {
    for (let displayCol = 0; displayCol < 8; displayCol++) {
      const row = flip ? 7 - displayRow : displayRow;
      const col = flip ? 7 - displayCol : displayCol;

      const sq = document.createElement("div");
      const isLight = (row + col) % 2 === 0;
      sq.className = `square ${isLight ? "light" : "dark"}`;
      sq.dataset.row = row;
      sq.dataset.col = col;

      // Highlight last move
      if (lastMove) {
        if ((row === lastMove.from.row && col === lastMove.from.col) ||
            (row === lastMove.to.row   && col === lastMove.to.col)) {
          sq.classList.add("last-move");
        }
      }

      // Highlight selected
      if (selectedSq && selectedSq.row === row && selectedSq.col === col) {
        sq.classList.add("selected");
      }

      // Highlight valid moves
      const key = `${row},${col}`;
      if (validMovesMap[key]) {
        const piece = gameState.board[row][col];
        sq.classList.add(piece ? "valid-capture" : "valid-move");
      }

      // King in check
      if (gameState.isInCheck()) {
        const kingPos = gameState.findKing(gameState.turn);
        if (kingPos && kingPos.row === row && kingPos.col === col) {
          sq.classList.add("in-check");
        }
      }

      // Piece
      const piece = gameState.board[row][col];
      if (piece) {
        const span = document.createElement("span");
        span.className = `piece ${piece.color}`;
        span.textContent = PIECE_UNICODE[piece.color][piece.type];
        sq.appendChild(span);
      }

      sq.addEventListener("click", () => onSquareClick(row, col));
      board.appendChild(sq);
    }
  }

  // Coords
  buildCoords(flip);
  updateTurnDots();
}

function buildCoords(flip) {
  const ranksLeft  = $("board-ranks");
  const ranksRight = $("board-ranks-right");
  const files      = $("board-files");
  if (!ranksLeft) return;
  ranksLeft.innerHTML = ranksRight.innerHTML = files.innerHTML = "";

  const rankLabels = flip ? ["1","2","3","4","5","6","7","8"] : ["8","7","6","5","4","3","2","1"];
  const fileLabels = flip ? ["h","g","f","e","d","c","b","a"] : ["a","b","c","d","e","f","g","h"];

  rankLabels.forEach(r => {
    [ranksLeft, ranksRight].forEach(el => {
      const lbl = document.createElement("span");
      lbl.className = "coord-label";
      lbl.textContent = r;
      el.appendChild(lbl);
    });
  });
  fileLabels.forEach(f => {
    const lbl = document.createElement("span");
    lbl.className = "coord-label-file";
    lbl.textContent = f;
    files.appendChild(lbl);
  });
}

function updateTurnDots() {
  const isWhiteTurn = gameState.turn === "white";
  $("self-turn-dot").classList.toggle("active",
    (myColor === "white" && isWhiteTurn) || (myColor === "black" && !isWhiteTurn));
  $("opponent-turn-dot").classList.toggle("active",
    (myColor === "white" && !isWhiteTurn) || (myColor === "black" && isWhiteTurn));
}

function updateStatusBar() {
  const statusEl = $("game-status");
  const textEl   = $("status-text");
  statusEl.className = "game-status";

  if (!isGameActive) {
    textEl.textContent = "Waiting for opponent…";
    return;
  }
  const isMyTurn = gameState.turn === myColor;
  const inCheck  = gameState.isInCheck();

  if (inCheck) {
    statusEl.classList.add("status-check");
    textEl.textContent = isMyTurn ? "⚠ You are in check!" : "⚠ Opponent in check!";
  } else if (isMyTurn) {
    statusEl.classList.add("status-your-turn");
    textEl.textContent = "Your turn";
  } else {
    textEl.textContent = "Opponent's turn…";
  }
}

// ─── CLICK-TO-MOVE ────────────────────────────────────────────────────────────
function onSquareClick(row, col) {
  if (!isGameActive) return;
  if (gameState.turn !== myColor) { showToast("Not your turn"); return; }

  const key   = `${row},${col}`;
  const piece = gameState.board[row][col];

  // If a square is already selected
  if (selectedSq) {
    const moves = validMovesMap[key];
    if (moves !== undefined) {
      // Execute the move
      executeMove(selectedSq.row, selectedSq.col, row, col);
      return;
    }
    // Click own piece — reselect
    if (piece && piece.color === myColor) {
      selectedSq = { row, col };
      computeValidMoves(row, col);
      renderBoard();
      return;
    }
    // Deselect
    selectedSq = null;
    validMovesMap = {};
    renderBoard();
    return;
  }

  // Nothing selected yet
  if (!piece || piece.color !== myColor) return;
  selectedSq = { row, col };
  computeValidMoves(row, col);
  renderBoard();
}

function computeValidMoves(row, col) {
  validMovesMap = {};
  const moves = gameState.getLegalMoves(row, col);
  moves.forEach(m => {
    validMovesMap[`${m.row},${m.col}`] = m;
  });
}

async function executeMove(fromRow, fromCol, toRow, toCol) {
  let promotion = null;

  // Check if pawn promotion needed
  const piece = gameState.board[fromRow][fromCol];
  if (piece && piece.type === "P") {
    if ((piece.color === "white" && toRow === 0) || (piece.color === "black" && toRow === 7)) {
      promotion = await promptPromotion();
    }
  }

  // Make move locally
  const result = gameState.makeMove(fromRow, fromCol, toRow, toCol, promotion);
  if (!result) { showToast("Invalid move"); return; }

  lastMove      = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
  selectedSq    = null;
  validMovesMap = {};
  recordMove(result.notation, null, null);
  renderBoard();
  updateStatusBar();

  // Send to server
  const fromAlg = squareToAlgebraic(fromRow, fromCol);
  const toAlg   = squareToAlgebraic(toRow, toCol);

  wsSend({
    type: "move",
    room_id: currentRoom,
    from: fromAlg,
    to: toAlg,
    promotion: promotion || undefined,
    move: `${fromAlg}${toAlg}${promotion ? promotion.toLowerCase() : ""}`
  });

  // Also call REST validate (optional, non-blocking)
  try {
    await apiFetch("/validate-move", {
      method: "POST",
      body: JSON.stringify({ room_id: currentRoom, from: fromAlg, to: toAlg, promotion })
    });
  } catch(_) { /* non-critical */ }

  // Check game over
  if (gameState.isCheckmate()) {
    showGameOver(myColor === gameState.turn ? "loss" : "win", "Checkmate");
  } else if (gameState.isStalemate()) {
    showGameOver("draw", "Stalemate");
  }
}

function promptPromotion() {
  return new Promise(resolve => {
    const options = ["Q","R","B","N"];
    const labels  = { Q:"Queen ♕", R:"Rook ♖", B:"Bishop ♗", N:"Knight ♘" };
    const overlay = document.createElement("div");
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:2000;display:flex;align-items:center;justify-content:center;`;
    const box = document.createElement("div");
    box.style.cssText = `background:var(--bg-card);border:1px solid var(--border-lit);border-radius:14px;padding:32px;text-align:center;`;
    box.innerHTML = `<p style="font-family:var(--font-display);color:var(--gold);font-size:18px;margin-bottom:20px">Promote Pawn</p>
      <div style="display:flex;gap:12px;">
      ${options.map(p => `<button data-p="${p}" style="padding:14px 18px;background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:22px;cursor:pointer;transition:0.15s ease;">${PIECE_UNICODE[myColor][p]}</button>`).join("")}
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve(btn.dataset.p);
      });
    });
  });
}

// ─── GAME OVER MODAL ──────────────────────────────────────────────────────────
function showGameOver(result, reason) {
  isGameActive = false;
  const modal  = $("game-over-modal");
  const icon   = $("modal-icon");
  const title  = $("modal-title");
  const body   = $("modal-body");

  const normalized = String(result).toLowerCase();
  if (normalized.includes("win") || normalized === myColor) {
    icon.textContent  = "♛";
    icon.style.color  = "var(--gold)";
    title.textContent = "Victory!";
    body.textContent  = reason ? `You won by ${reason}` : "You won!";
  } else if (normalized.includes("draw") || normalized.includes("stale")) {
    icon.textContent  = "♙";
    icon.style.color  = "var(--silver)";
    title.textContent = "Draw";
    body.textContent  = reason || "The game is a draw.";
  } else {
    icon.textContent  = "♟";
    icon.style.color  = "var(--red)";
    title.textContent = "Defeat";
    body.textContent  = reason ? `You lost by ${reason}` : "You lost.";
  }

  modal.classList.remove("hidden");
  $("game-status").className = "game-status status-over";
  $("status-text").textContent = "Game over";
}

$("modal-back-btn").addEventListener("click", () => {
  $("game-over-modal").classList.add("hidden");
  currentRoom = null;
  loadDashboard();
  showScreen("dashboard-screen");
});

// ─── COORDINATE HELPERS ───────────────────────────────────────────────────────
function squareToAlgebraic(row, col) {
  return String.fromCharCode(97 + col) + (8 - row);
}
function algebraicToSquare(alg) {
  if (!alg || alg.length < 2) return null;
  const col = alg.charCodeAt(0) - 97;
  const row = 8 - parseInt(alg[1]);
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  return { row, col };
}

// ─── CHESS ENGINE ─────────────────────────────────────────────────────────────
class ChessGame {
  constructor() {
    this.board  = this.initBoard();
    this.turn   = "white";
    this.castling = { white: { kSide: true, qSide: true }, black: { kSide: true, qSide: true } };
    this.enPassant = null;
    this.halfMove  = 0;
    this.fullMove  = 1;
  }

  initBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    const backRow = ["R","N","B","Q","K","B","N","R"];
    backRow.forEach((type, col) => {
      b[0][col] = { type, color: "black" };
      b[7][col] = { type, color: "white" };
    });
    for (let col = 0; col < 8; col++) {
      b[1][col] = { type: "P", color: "black" };
      b[6][col] = { type: "P", color: "white" };
    }
    return b;
  }

  getPiece(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return this.board[r][c];
  }

  findKing(color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]?.type === "K" && this.board[r][c]?.color === color)
          return { row: r, col: c };
    return null;
  }

  isSquareAttacked(row, col, byColor) {
    // Check all opponent pieces
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== byColor) continue;
        const attacks = this.getRawMoves(r, c, true);
        if (attacks.some(m => m.row === row && m.col === col)) return true;
      }
    }
    return false;
  }

  isInCheck(color) {
    color = color || this.turn;
    const king = this.findKing(color);
    if (!king) return false;
    const opp = color === "white" ? "black" : "white";
    return this.isSquareAttacked(king.row, king.col, opp);
  }

  getRawMoves(row, col, attacksOnly = false) {
    const piece = this.board[row][col];
    if (!piece) return [];
    const moves = [];
    const { type, color } = piece;
    const opp = color === "white" ? "black" : "white";
    const dir = color === "white" ? -1 : 1;

    const addIfValid = (r, c, capture = true, move = true) => {
      if (r < 0 || r > 7 || c < 0 || c > 7) return;
      const target = this.board[r][c];
      if (target) {
        if (target.color === color) return;
        if (capture) moves.push({ row: r, col: c });
      } else {
        if (move) moves.push({ row: r, col: c });
      }
    };

    const slide = (dr, dc) => {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const t = this.board[r][c];
        if (t) {
          if (t.color !== color) moves.push({ row: r, col: c });
          break;
        }
        moves.push({ row: r, col: c });
        r += dr; c += dc;
      }
    };

    switch(type) {
      case "P": {
        if (!attacksOnly) {
          // Forward
          const r1 = row + dir;
          if (r1 >= 0 && r1 < 8 && !this.board[r1][col])
            moves.push({ row: r1, col });
          // Double push from start
          const startRow = color === "white" ? 6 : 1;
          const r2 = row + 2 * dir;
          if (row === startRow && !this.board[row + dir][col] && !this.board[r2][col])
            moves.push({ row: r2, col });
        }
        // Captures
        [-1, 1].forEach(dc => {
          const r = row + dir, c = col + dc;
          if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const t = this.board[r][c];
            if (t && t.color === opp) moves.push({ row: r, col: c });
            else if (!t && attacksOnly) moves.push({ row: r, col: c }); // For attack detection
            // En passant
            if (!attacksOnly && this.enPassant &&
                this.enPassant.row === r && this.enPassant.col === c)
              moves.push({ row: r, col: c, enPassant: true });
          }
        });
        break;
      }
      case "N": {
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) =>
          addIfValid(row+dr, col+dc));
        break;
      }
      case "B": { [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => slide(dr,dc)); break; }
      case "R": { [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); break; }
      case "Q": { [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); break; }
      case "K": {
        [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) =>
          addIfValid(row+dr, col+dc));
        if (!attacksOnly) {
          // Castling
          const cs = this.castling[color];
          if (cs.kSide && !this.board[row][col+1] && !this.board[row][col+2] &&
              !this.isSquareAttacked(row, col, opp) &&
              !this.isSquareAttacked(row, col+1, opp) &&
              !this.isSquareAttacked(row, col+2, opp))
            moves.push({ row, col: col+2, castle: "k" });
          if (cs.qSide && !this.board[row][col-1] && !this.board[row][col-2] && !this.board[row][col-3] &&
              !this.isSquareAttacked(row, col, opp) &&
              !this.isSquareAttacked(row, col-1, opp) &&
              !this.isSquareAttacked(row, col-2, opp))
            moves.push({ row, col: col-2, castle: "q" });
        }
        break;
      }
    }
    return moves;
  }

  getLegalMoves(row, col) {
    const piece = this.board[row][col];
    if (!piece || piece.color !== this.turn) return [];
    const raw = this.getRawMoves(row, col);
    return raw.filter(m => {
      // Simulate move
      const saved = this.board[m.row][m.col];
      const savedEP = this.enPassant;
      this.board[m.row][m.col] = piece;
      this.board[row][col] = null;
      if (m.enPassant) {
        const epDir = piece.color === "white" ? 1 : -1;
        this.board[m.row + epDir][m.col] = null;
      }
      const legal = !this.isInCheck(piece.color);
      // Undo
      this.board[row][col] = piece;
      this.board[m.row][m.col] = saved;
      if (m.enPassant) {
        const epDir = piece.color === "white" ? 1 : -1;
        this.board[m.row + epDir][m.col] = { type: "P", color: piece.color === "white" ? "black" : "white" };
      }
      this.enPassant = savedEP;
      return legal;
    });
  }

  makeMove(fromRow, fromCol, toRow, toCol, promotion = "Q") {
    const piece = this.board[fromRow][fromCol];
    if (!piece || piece.color !== this.turn) return null;

    const legal = this.getLegalMoves(fromRow, fromCol);
    const move  = legal.find(m => m.row === toRow && m.col === toCol);
    if (!move) return null;

    const captured = this.board[toRow][toCol];

    // Build notation before modifying board
    const notation = this.buildNotation(fromRow, fromCol, toRow, toCol, piece, captured, move, promotion);

    // Execute move
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    // En passant capture
    if (move.enPassant) {
      const epDir = piece.color === "white" ? 1 : -1;
      this.board[toRow + epDir][toCol] = null;
    }

    // Pawn promotion
    if (piece.type === "P" && (toRow === 0 || toRow === 7)) {
      this.board[toRow][toCol] = { type: promotion || "Q", color: piece.color };
    }

    // Castling rook move
    if (move.castle) {
      if (move.castle === "k") {
        this.board[toRow][toCol - 1] = this.board[toRow][7];
        this.board[toRow][7] = null;
      } else {
        this.board[toRow][toCol + 1] = this.board[toRow][0];
        this.board[toRow][0] = null;
      }
    }

    // Update castling rights
    if (piece.type === "K") this.castling[piece.color] = { kSide: false, qSide: false };
    if (piece.type === "R") {
      if (fromCol === 7) this.castling[piece.color].kSide = false;
      if (fromCol === 0) this.castling[piece.color].qSide = false;
    }

    // Set en passant
    if (piece.type === "P" && Math.abs(toRow - fromRow) === 2) {
      this.enPassant = { row: (fromRow + toRow) / 2, col: fromCol };
    } else {
      this.enPassant = null;
    }

    this.turn = this.turn === "white" ? "black" : "white";
    return { notation, captured, move };
  }

  buildNotation(fr, fc, tr, tc, piece, captured, move, promo) {
    if (move.castle) return move.castle === "k" ? "O-O" : "O-O-O";
    let n = "";
    if (piece.type !== "P") n += piece.type;
    else if (captured || move.enPassant) n += String.fromCharCode(97 + fc);
    if (captured || move.enPassant) n += "x";
    n += squareToAlgebraic(tr, tc);
    if (piece.type === "P" && (tr === 0 || tr === 7)) n += "=" + (promo || "Q");
    return n;
  }

  isCheckmate() {
    if (!this.isInCheck()) return false;
    return this.hasNoLegalMoves();
  }

  isStalemate() {
    if (this.isInCheck()) return false;
    return this.hasNoLegalMoves();
  }

  hasNoLegalMoves() {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === this.turn && this.getLegalMoves(r, c).length > 0)
          return false;
      }
    return true;
  }
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
(function init() {
  const token = localStorage.getItem("token");
  if (token) {
    loadDashboard();
  } else {
    showScreen("auth-screen");
  }
})();
