// ===========================================================================
// Online multiplayer: lobbies with codes, up to 10 players.
//   • Impostor   — everyone gets the same secret number except one (the
//                  impostor). Players go one-by-one, blind (the timer is never
//                  shown). Every device beeps when the active player starts and
//                  stops, so you can play even in different rooms. Then vote.
//   • Closest    — everyone aims for the same *random* target time, blind.
//                  Times are revealed at the end; closest to the target wins.
// Backed by Firebase Realtime Database + anonymous auth (client-only).
// ===========================================================================

import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, remove, onValue, onDisconnect,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const MAX_PLAYERS = 10;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous O/0/I/1
const CODE_LEN = 4;

// ---- DOM ----
const $ = (id) => document.getElementById(id);
const onlineView = $("onlineView");
const titleEl = $("title");
const screens = Array.from(document.querySelectorAll("#onlineView .mp-screen"));

const els = {
  notice: $("mpNotConfigured"),
  name: $("mpName"),
  codeInput: $("mpCodeInput"),
  joinBtn: $("mpJoinBtn"),
  quickJoin: $("mpQuickJoin"),
  quickPicks: $("mpQuickPicks"),
  picksList: $("mpPicksList"),
  shufflePicks: $("mpShufflePicks"),
  cancelPicks: $("mpCancelPicks"),
  lobbyList: $("mpLobbyList"),
  homeError: $("mpHomeError"),
  lobbyCode: $("mpLobbyCode"),
  copyCode: $("mpCopyCode"),
  gameTypeLabel: $("mpGameTypeLabel"),
  players: $("mpPlayers"),
  startBtn: $("mpStartBtn"),
  lobbyHint: $("mpLobbyHint"),
  leaveBtn: $("mpLeaveBtn"),
  roleCard: $("mpRoleCard"),
  turnInfo: $("mpTurnInfo"),
  time: $("mpTime"),
  playStatus: $("mpPlayStatus"),
  startStop: $("mpStartStop"),
  waiting: $("mpWaiting"),
  voteList: $("mpVoteList"),
  voteStatus: $("mpVoteStatus"),
  revealIcon: $("mpRevealIcon"),
  resultsTitle: $("mpResultsTitle"),
  resultsBody: $("mpResultsBody"),
  playAgain: $("mpPlayAgain"),
  resultsLeave: $("mpResultsLeave"),
};

// ---- Audio (mirrors the solo chirps) ----
let audioCtx = null;
function ensureCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}
// Browsers (especially iOS Safari) start the audio context suspended and only
// allow it to resume from a user gesture. Unlock it on the first tap so that
// later beeps — including ones triggered remotely — actually play.
function unlockAudio() {
  const ac = ensureCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume();
  try {
    const buf = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start(0);
  } catch (_) { /* ignore */ }
}
function beep(freq, duration, type) {
  try {
    const ac = ensureCtx();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch (_) { /* ignore */ }
}
const startSound = () => { beep(660, 0.12, "sine"); setTimeout(() => beep(990, 0.16, "sine"), 90); };
const stopSound = () => { beep(550, 0.12, "sine"); setTimeout(() => beep(360, 0.18, "sine"), 90); };

// ---- Helpers ----
function showScreen(id) {
  screens.forEach((s) => (s.hidden = s.id !== id));
}
function makeCode() {
  let c = "";
  for (let i = 0; i < CODE_LEN; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmt(ms) {
  const t = Math.floor(ms);
  const s = Math.floor(t / 1000);
  const cc = Math.floor((t % 1000) / 10);
  return s + "." + String(cc).padStart(2, "0") + "s";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// Easter egg: "aaqz" is always 5 seconds off and can never win.
const RIGGED_OFFSET = 5; // seconds
function isRigged(name) {
  return String(name || "").trim().toLowerCase() === "aaqz";
}

// ----- Profanity filter for player names (aaqz is always allowed) -----
const ALWAYS_ALLOW = ["aaqz"];
const BANNED_WORDS = [
  "fuck", "motherfucker", "shit", "bitch", "cunt", "asshole", "bastard",
  "slut", "whore", "nigger", "nigga", "faggot", "retard", "pussy",
  "dickhead", "cock", "wanker", "twat", "jackoff", "jerkoff",
];
// Fold common leet substitutions so "sh1t" / "f@ck" are caught too.
function normalizeName(s) {
  return String(s).toLowerCase()
    .replace(/@/g, "a").replace(/\$/g, "s")
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e")
    .replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t")
    .replace(/[^a-z]/g, "");
}
function isCleanName(name) {
  if (ALWAYS_ALLOW.includes(String(name || "").trim().toLowerCase())) return true;
  const n = normalizeName(name);
  return !BANNED_WORDS.some((w) => n.includes(w));
}
const MASK = '•&nbsp;•<span class="display__ms">&nbsp;••</span>';

// ---- State ----
let db = null;
let uid = null;
let myName = "";
let code = null;          // current game code
let isHost = false;
let game = null;          // latest snapshot of games/{code}
let myRole = null;        // latest snapshot of roles/{code}/{uid}
let gameUnsub = null;
let roleUnsub = null;
let lobbiesUnsub = null;  // live list of public games on the home screen
let lastSignalId = null;  // de-dupes the cross-device start/stop beeps
let myVisibility = "public"; // visibility for games I create

// Local turn timing (this device only)
let turnRunning = false;
let turnStart = 0;

// =====================  CONNECTION  =====================
function initFirebase() {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  const auth = getAuth(app);
  onAuthStateChanged(auth, (user) => { if (user) uid = user.uid; });
  signInAnonymously(auth).catch((e) => {
    els.homeError.textContent = "Couldn't connect: " + (e.code || e.message);
  });
}

// =====================  CREATE / JOIN  =====================
async function createGame(mode) {
  if (!uid) return;
  myName = (els.name.value || "Player").trim().slice(0, 14);

  let candidate;
  for (let i = 0; i < 8; i++) {
    candidate = makeCode();
    const snap = await get(ref(db, "games/" + candidate));
    if (!snap.exists()) break;
  }
  code = candidate;
  isHost = true;
  lastSignalId = null;

  await set(ref(db, "games/" + code), {
    host: uid,
    mode,
    state: "lobby",
    createdAt: Date.now(),
    target: null,
    currentTurnIndex: 0,
    public: myVisibility === "public",
    players: { [uid]: { name: myName, joinedAt: Date.now() } },
  });

  onDisconnect(ref(db, "games/" + code)).remove();
  onDisconnect(ref(db, "roles/" + code)).remove();
  onDisconnect(ref(db, "lobbies/" + code)).remove();
  subscribe();
}

async function joinGame(explicitCode) {
  if (!uid) return;
  myName = (els.name.value || "Player").trim().slice(0, 14);
  const wanted = (explicitCode || els.codeInput.value || "").trim().toUpperCase();
  if (wanted.length !== CODE_LEN) {
    els.homeError.textContent = "Enter the " + CODE_LEN + "-character code.";
    return;
  }
  const snap = await get(ref(db, "games/" + wanted));
  if (!snap.exists()) { els.homeError.textContent = "No game with that code."; return; }
  const g = snap.val();
  if (g.state !== "lobby") { els.homeError.textContent = "That game already started."; return; }
  if (Object.keys(g.players || {}).length >= MAX_PLAYERS) {
    els.homeError.textContent = "That game is full (" + MAX_PLAYERS + " players).";
    return;
  }

  code = wanted;
  isHost = false;
  lastSignalId = null;
  await set(ref(db, "games/" + code + "/players/" + uid), { name: myName, joinedAt: Date.now() });
  onDisconnect(ref(db, "games/" + code + "/players/" + uid)).remove();
  subscribe();
}

function subscribe() {
  els.homeError.textContent = "";
  stopLobbiesListener(); // we're leaving the home screen
  gameUnsub = onValue(ref(db, "games/" + code), (snap) => {
    game = snap.val();
    if (!game) { alert("The game was closed by the host."); return leaveGame(true); }
    handleSignal(game.signal);
    maintainLobbyIndex();
    render();
  });
  roleUnsub = onValue(ref(db, "roles/" + code + "/" + uid), (snap) => {
    myRole = snap.val();
    render();
  });
}

// ----- Public lobby index (so random players can find open games) -----
// The host keeps a lightweight `lobbies/{code}` entry in sync: present only
// while the game is public, in the lobby, and not full.
function maintainLobbyIndex() {
  if (!isHost || !game) return;
  const count = Object.keys(game.players || {}).length;
  const open = game.public && game.state === "lobby" && count < MAX_PLAYERS;
  const hostName = (game.players[game.host] || {}).name || "Someone";
  if (open) {
    set(ref(db, "lobbies/" + code), {
      host: hostName, mode: game.mode, count, createdAt: game.createdAt,
    });
  } else {
    remove(ref(db, "lobbies/" + code));
  }
}

function startLobbiesListener() {
  if (lobbiesUnsub || !db) return;
  lobbiesUnsub = onValue(ref(db, "lobbies"), renderLobbies, () => {
    // Most likely the updated security rules haven't been published yet.
    els.lobbyList.innerHTML =
      '<li class="mp-empty">Public games need the updated database rules (see README).</li>';
  });
}
function stopLobbiesListener() {
  if (lobbiesUnsub) { lobbiesUnsub(); lobbiesUnsub = null; }
}

// Open, well-formed lobby codes from a /lobbies snapshot value.
function openLobbyCodes(data) {
  return Object.keys(data).filter(
    (c) => /^[A-Z0-9]{4}$/.test(c) && (Number(data[c].count) || 1) < MAX_PLAYERS);
}

// One lobby row. `c` is always escaped — never trust a DB key as markup.
function lobbyRowHtml(c, l) {
  const emoji = l.mode === "impostor" ? "🕵️" : "🎯";
  const name = l.mode === "impostor" ? "Impostor" : "Closest Wins";
  const count = Number(l.count) || 1;
  return '<li><span class="pname">' + escapeHtml(l.host) + "</span>" +
    '<span class="mp-lobby-meta">' + emoji + " " + name + " · " + count + "/" + MAX_PLAYERS + "</span>" +
    '<button class="joinopen btn btn--ghost" data-code="' + escapeHtml(c) + '">Join</button></li>';
}

function renderLobbies(snap) {
  const data = snap.val() || {};
  const codes = openLobbyCodes(data);
  if (!codes.length) {
    els.lobbyList.innerHTML = '<li class="mp-empty">No public games right now — start one above!</li>';
    return;
  }
  codes.sort((a, b) => (data[b].createdAt || 0) - (data[a].createdAt || 0)); // newest first
  els.lobbyList.innerHTML = codes.map((c) => lobbyRowHtml(c, data[c])).join("");
}

// "Quick join" now offers a handful of random open games to choose from
// instead of dropping you straight into one.
const QUICK_PICK_COUNT = 4;
async function quickJoin() {
  if (!requireReady()) return;
  const snap = await get(ref(db, "lobbies"));
  const data = snap.val() || {};
  const codes = openLobbyCodes(data);
  if (!codes.length) {
    els.quickPicks.hidden = true;
    els.homeError.textContent = "No open games right now — start one!";
    return;
  }
  els.homeError.textContent = "";
  renderQuickPicks(shuffle(codes).slice(0, QUICK_PICK_COUNT), data);
  els.quickPicks.hidden = false;
}

function renderQuickPicks(codes, data) {
  els.picksList.innerHTML = codes.map((c) => lobbyRowHtml(c, data[c])).join("");
}

function closeQuickPicks() {
  els.quickPicks.hidden = true;
  els.picksList.innerHTML = "";
}

// Cross-device beep: every client plays the active player's start/stop.
function handleSignal(sig) {
  if (!sig) return;
  if (lastSignalId === null) { lastSignalId = sig.id; return; } // don't replay on first load
  if (sig.id === lastSignalId) return;
  lastSignalId = sig.id;
  if (sig.by === uid) return;            // the actor already heard it locally
  if (sig.kind === "start") startSound();
  else if (sig.kind === "stop") stopSound();
}

async function leaveGame(skipRemove) {
  if (gameUnsub) { gameUnsub(); gameUnsub = null; }
  if (roleUnsub) { roleUnsub(); roleUnsub = null; }
  if (!skipRemove && code && uid) {
    try {
      if (isHost) {
        await remove(ref(db, "games/" + code));
        await remove(ref(db, "roles/" + code));
        await remove(ref(db, "lobbies/" + code));
      } else {
        await onDisconnect(ref(db, "games/" + code + "/players/" + uid)).cancel();
        await remove(ref(db, "games/" + code + "/players/" + uid));
      }
    } catch (_) { /* ignore */ }
  }
  code = null; isHost = false; game = null; myRole = null;
  turnRunning = false; lastSignalId = null;
  titleEl.textContent = "ONLINE";
  closeQuickPicks();
  showScreen("mpHome");
  startLobbiesListener(); // back on the home screen — show open games again
}

// =====================  HOST: START ROUND  =====================
function randomTarget() {
  return Math.round((2 + Math.random() * 7) * 10) / 10; // 2.0–9.0s
}

async function startRound() {
  const ids = Object.keys(game.players || {});
  if (ids.length < 2) { els.lobbyHint.textContent = "Need at least 2 players."; return; }

  const order = shuffle(ids);
  const updates = {};
  updates["games/" + code + "/turnOrder"] = order;
  updates["games/" + code + "/currentTurnIndex"] = 0;
  updates["games/" + code + "/results"] = null;
  updates["games/" + code + "/votes"] = null;
  updates["games/" + code + "/impostor"] = null;
  updates["games/" + code + "/secret"] = null;
  updates["games/" + code + "/signal"] = null;
  updates["games/" + code + "/state"] = "playing";

  if (game.mode === "impostor") {
    const secret = randomTarget();
    const impostor = ids[Math.floor(Math.random() * ids.length)];
    ids.forEach((pid) => {
      updates["roles/" + code + "/" + pid] =
        pid === impostor ? { role: "impostor" } : { role: "crew", number: secret };
    });
  } else {
    updates["games/" + code + "/target"] = randomTarget();
  }
  await update(ref(db), updates);
}

// =====================  PER-TURN BLIND STOPWATCH  =====================
function myTurn() {
  if (!game || !game.turnOrder) return false;
  return game.turnOrder[game.currentTurnIndex] === uid;
}

function broadcast(kind) {
  set(ref(db, "games/" + code + "/signal"), { kind, by: uid, id: Date.now() });
}

function onStartStop() {
  if (!myTurn()) return;
  unlockAudio();
  if (!turnRunning) {
    turnRunning = true;
    turnStart = performance.now();
    els.startStop.textContent = "Stop";
    els.startStop.classList.add("is-stop");
    els.playStatus.textContent = "Listening…";
    startSound();
    broadcast("start");
  } else {
    turnRunning = false;
    const elapsed = performance.now() - turnStart;
    els.startStop.classList.remove("is-stop");
    els.startStop.disabled = true;
    stopSound();
    broadcast("stop");
    advanceTurn(elapsed);
  }
}

async function advanceTurn(elapsedMs) {
  const order = game.turnOrder;
  const next = game.currentTurnIndex + 1;
  const updates = {};
  // Record every player's time (revealed at the end — even in Impostor).
  updates["games/" + code + "/results/" + uid] = Math.round(elapsedMs);
  if (next >= order.length) {
    updates["games/" + code + "/state"] = game.mode === "impostor" ? "voting" : "results";
  } else {
    updates["games/" + code + "/currentTurnIndex"] = next;
  }
  await update(ref(db), updates);
}

// =====================  VOTING (impostor)  =====================
async function castVote(suspectId) {
  await set(ref(db, "games/" + code + "/votes/" + uid), suspectId);
  const votes = Object.assign({}, game.votes || {}, { [uid]: suspectId });
  const ids = Object.keys(game.players || {});
  if (ids.every((pid) => votes[pid])) {
    await update(ref(db, "games/" + code), { state: "results" });
  }
}

// =====================  RENDER  =====================
function render() {
  if (!game) return;
  const state = game.state;
  const players = game.players || {};
  const names = (id) => (players[id] ? players[id].name : "—");

  if (state === "lobby") {
    titleEl.textContent = game.mode === "impostor" ? "IMPOSTOR LOBBY" : "LOBBY";
    showScreen("mpLobby");
    els.lobbyCode.textContent = code;
    els.gameTypeLabel.textContent = game.mode === "impostor" ? "🕵️ Impostor" : "🎯 Closest Wins";

    const ids = Object.keys(players);
    els.players.innerHTML = ids.map((id) => {
      const tags = [];
      if (id === game.host) tags.push('<span class="tag">host</span>');
      if (id === uid) tags.push('<span class="tag tag--you">you</span>');
      return '<li><span class="pname">' + escapeHtml(players[id].name) + "</span>" + tags.join("") + "</li>";
    }).join("");

    els.startBtn.hidden = !isHost;
    els.lobbyHint.textContent = isHost
      ? (ids.length < 2 ? "Waiting for players to join (need 2+)…"
        : "Ready — " + ids.length + "/" + MAX_PLAYERS + " players.")
      : "Waiting for the host to start…";
    return;
  }

  if (state === "playing") {
    titleEl.textContent = game.mode === "impostor" ? "IMPOSTOR" : "CLOSEST WINS";
    showScreen("mpPlay");
    els.time.innerHTML = MASK;

    if (game.mode === "impostor") {
      if (myRole && myRole.role === "impostor") {
        els.roleCard.className = "mp-role mp-role--impostor";
        els.roleCard.innerHTML = "🤫 You're the <strong>IMPOSTOR</strong><br><span>No number — blend in by ear.</span>";
      } else if (myRole && myRole.role === "crew") {
        els.roleCard.className = "mp-role mp-role--crew";
        els.roleCard.innerHTML = "Your secret number<br><strong>" + myRole.number + "s</strong>";
      } else {
        els.roleCard.className = "mp-role";
        els.roleCard.innerHTML = "Getting your secret…";
      }
    } else {
      els.roleCard.className = "mp-role mp-role--crew";
      els.roleCard.innerHTML = "Target<br><strong>" + game.target + "s</strong>";
    }

    const order = game.turnOrder || [];
    const currentId = order[game.currentTurnIndex];
    els.turnInfo.textContent = "Turn " + (game.currentTurnIndex + 1) + " of " + order.length;

    if (myTurn()) {
      els.startStop.hidden = false;
      els.startStop.disabled = false;
      if (!turnRunning) {
        els.startStop.textContent = "Start";
        els.startStop.classList.remove("is-stop");
        els.playStatus.textContent = "Your turn — go blind!";
      }
      els.waiting.textContent = "";
    } else {
      els.startStop.hidden = true;
      els.playStatus.textContent = "";
      els.waiting.textContent = "Listen… " + names(currentId) + " is taking their turn.";
    }
    return;
  }

  if (state === "voting") {
    titleEl.textContent = "WHO'S THE IMPOSTOR?";
    showScreen("mpVote");
    const ids = Object.keys(players);
    const myVote = (game.votes || {})[uid];
    els.voteList.innerHTML = ids.map((id) => {
      const voted = myVote === id ? " is-picked" : "";
      const disabled = myVote ? " disabled" : "";
      const me = id === uid ? " (you)" : "";
      return '<li><button class="votebtn' + voted + '" data-id="' + escapeHtml(id) + '"' + disabled + ">" +
        escapeHtml(players[id].name) + me + "</button></li>";
    }).join("");
    const count = Object.keys(game.votes || {}).length;
    els.voteStatus.textContent = myVote
      ? "Vote locked. " + count + "/" + ids.length + " voted…"
      : "Tap the player you think had no number.";
    return;
  }

  if (state === "results") {
    showScreen("mpResults");
    els.playAgain.hidden = !isHost;
    if (game.mode === "impostor") renderImpostorResults(players, names);
    else renderClosestResults(players, names);
    return;
  }
}

function renderClosestResults(players, names) {
  titleEl.textContent = "RESULTS";
  els.revealIcon.hidden = false;
  els.revealIcon.textContent = "🎯";
  els.resultsTitle.innerHTML = "Closest to <strong>" + game.target + "s</strong> wins";
  const results = game.results || {};
  const rows = Object.keys(results).map((id) => {
    const rigged = isRigged(names(id));
    const secs = rigged ? game.target + RIGGED_OFFSET : results[id] / 1000;
    const diff = rigged ? RIGGED_OFFSET : Math.abs(secs - game.target);
    return { id, secs, diff, rigged };
  }).sort((a, b) => {
    if (a.rigged !== b.rigged) return a.rigged ? 1 : -1; // rigged always ranks last
    return a.diff - b.diff;
  });

  els.resultsBody.innerHTML = rows.map((r, i) => {
    const win = i === 0 && !r.rigged; // rigged players can never be crowned
    const crown = win ? "👑 " : (i + 1) + ". ";
    const cls = win ? "mp-rank mp-rank--win" : "mp-rank";
    return '<div class="' + cls + '"><span>' + crown + escapeHtml(names(r.id)) +
      '</span><span class="mp-rank__t">' + r.secs.toFixed(2) + "s · " +
      (r.diff === 0 ? "spot on" : "±" + r.diff.toFixed(2) + "s") + "</span></div>";
  }).join("");
}

function renderImpostorResults(players, names) {
  titleEl.textContent = "REVEAL";
  // The impostor's own client reveals their identity; a crew client reveals the
  // secret number — no single device knew both, keeping the round fair.
  if (myRole && myRole.role === "impostor" && !game.impostor) {
    set(ref(db, "games/" + code + "/impostor"), uid);
  }
  if (myRole && myRole.role === "crew" && game.secret == null && myRole.number != null) {
    set(ref(db, "games/" + code + "/secret"), myRole.number);
  }

  const votes = game.votes || {};
  const tally = {};
  Object.values(votes).forEach((sid) => { tally[sid] = (tally[sid] || 0) + 1; });
  let topId = null, topN = -1;
  Object.keys(tally).forEach((id) => { if (tally[id] > topN) { topN = tally[id]; topId = id; } });

  const impostorId = game.impostor;
  let icon, headline;
  if (!impostorId) {
    icon = "🕵️"; headline = "The impostor left before the reveal.";
  } else if (topId === impostorId && topN > 0) {
    icon = "✅"; headline = "Caught! <strong>" + escapeHtml(names(impostorId)) + "</strong> was the impostor.";
  } else {
    icon = "🕵️"; headline = "<strong>" + escapeHtml(names(impostorId)) + "</strong> was the impostor — and got away!";
  }
  els.revealIcon.hidden = false;
  els.revealIcon.textContent = icon;
  els.resultsTitle.innerHTML = headline +
    (game.secret != null ? '<div class="mp-secret">The number was ' + game.secret + "s</div>" : "");

  const results = game.results || {};
  const ids = Object.keys(players);
  els.resultsBody.innerHTML = ids.map((id) => {
    const isImp = id === impostorId;
    // Easter egg: "aaqz" is always 5s off the secret number.
    let t;
    if (isRigged(names(id)) && game.secret != null) t = fmt((game.secret + RIGGED_OFFSET) * 1000);
    else t = results[id] != null ? fmt(results[id]) : "—";
    const v = tally[id] || 0;
    const cls = "mp-rank" + (isImp ? " mp-rank--win" : "");
    const label = (isImp ? "🤫 " : "") + escapeHtml(names(id)) + (isImp ? " (impostor)" : "");
    return '<div class="' + cls + '"><span>' + label + '</span><span class="mp-rank__t">' +
      t + " · " + v + (v === 1 ? " vote" : " votes") + "</span></div>";
  }).join("");
}

async function playAgain() {
  await update(ref(db, "games/" + code), {
    state: "lobby", currentTurnIndex: 0, turnOrder: null,
    results: null, votes: null, impostor: null, secret: null, signal: null,
  });
  await remove(ref(db, "roles/" + code));
  turnRunning = false;
  lastSignalId = null;
}

// =====================  WIRING  =====================
export function openOnline() {
  document.getElementById("soloView").hidden = true;
  onlineView.hidden = false;
  titleEl.textContent = "ONLINE";
  if (!isConfigured) { showScreen("mpNotConfigured"); return; }
  showScreen("mpHome");
  startLobbiesListener();
}
export function closeOnline() {
  onlineView.hidden = true;
  document.getElementById("soloView").hidden = false;
  if (!code) stopLobbiesListener(); // keep it running if we're mid-game in the background
}

function requireReady() {
  if (!uid) { els.homeError.textContent = "Connecting… try again in a second."; return false; }
  if (!(els.name.value || "").trim()) { els.homeError.textContent = "Enter your name first."; return false; }
  if (!isCleanName(els.name.value)) { els.homeError.textContent = "Please pick a friendlier name."; return false; }
  els.homeError.textContent = "";
  return true;
}

function bind() {
  if (isConfigured) initFirebase();

  // Unlock audio on the very first interaction anywhere (for cross-device beeps).
  document.addEventListener("pointerdown", unlockAudio);

  // Home: the two game-type cards create that game directly.
  document.querySelectorAll("#mpHome .gametype").forEach((b) =>
    b.addEventListener("click", () => { if (requireReady()) createGame(b.dataset.mode); }));

  // Public / code-only visibility toggle for games I create.
  document.querySelectorAll("#mpHome .vis").forEach((b) =>
    b.addEventListener("click", () => {
      myVisibility = b.dataset.vis;
      document.querySelectorAll("#mpHome .vis").forEach((x) => x.classList.toggle("is-active", x === b));
    }));

  // Quick join shows a few random games to choose from.
  els.quickJoin.addEventListener("click", quickJoin);
  els.shufflePicks.addEventListener("click", quickJoin); // re-roll the options
  els.cancelPicks.addEventListener("click", closeQuickPicks);
  els.picksList.addEventListener("click", (e) => {
    const btn = e.target.closest(".joinopen");
    if (btn && requireReady()) joinGame(btn.dataset.code);
  });

  // Join an open game straight from the full public list.
  els.lobbyList.addEventListener("click", (e) => {
    const btn = e.target.closest(".joinopen");
    if (btn && requireReady()) joinGame(btn.dataset.code);
  });

  els.joinBtn.addEventListener("click", () => { if (requireReady()) joinGame(); });
  els.codeInput.addEventListener("input", () => {
    els.codeInput.value = els.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });
  els.copyCode.addEventListener("click", () => {
    if (navigator.clipboard) navigator.clipboard.writeText(code);
    els.copyCode.textContent = "✓";
    setTimeout(() => (els.copyCode.textContent = "⧉"), 1200);
  });
  els.startBtn.addEventListener("click", startRound);
  els.startStop.addEventListener("click", onStartStop);
  els.leaveBtn.addEventListener("click", () => leaveGame());
  els.resultsLeave.addEventListener("click", () => leaveGame());
  els.playAgain.addEventListener("click", playAgain);
  els.voteList.addEventListener("click", (e) => {
    const btn = e.target.closest(".votebtn");
    if (btn && !btn.disabled) castVote(btn.dataset.id);
  });
}

bind();
