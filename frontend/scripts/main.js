import { JUTSUS, RANKS, SEALS, sealById } from "./data.js";
import { sealDiagram } from "./diagrams.js";
import * as game from "./game.js";
import { VisionEngine, loadTemplates, saveTemplate, clearTemplates, scoreSeal } from "./vision.js";

const $ = (sel) => document.querySelector(sel);

const RING_CIRC = 326.7;
const LESSON = { threshold: 0.75, holdMs: 1200, reps: 2 };
const JUTSU = { threshold: 0.72, holdMs: 500 };
const CALIBRATION_FRAMES = 45;

let engine = null;
let drill = null; // { type: 'lesson' | 'jutsu' | 'calibrate', ... }

// ---------- Header / nav ----------

function renderHeader() {
  const rank = RANKS.find((r) => r.id === game.state.rank);
  $("#rank-badge").textContent = `${rank.icon} ${rank.name}`;
  $("#xp-badge").textContent = `${game.state.xp} XP`;
  $("#auth-button").textContent = game.auth ? `${game.auth.username} · log out` : "Log in";
}

function showScreen(name) {
  for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
  $(`#screen-${name}`).classList.remove("hidden");
  for (const b of document.querySelectorAll(".nav button")) {
    b.classList.toggle("active", b.dataset.nav === name);
  }
  if (name !== "train") stopDrill();
  if (name === "dojo") renderDojo();
  if (name === "leaderboard") renderLeaderboard();
  if (name === "settings") renderCalibrateGrid();
}

document.body.addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) showScreen(nav.dataset.nav);
});

// ---------- Dojo ----------

function renderDojo() {
  renderHeader();
  const currentIdx = game.rankIndex();
  $("#rank-path").innerHTML = RANKS.map((r, i) => {
    const cls = i < currentIdx ? "reached" : i === currentIdx ? "reached current" : "";
    return `${i ? '<span class="rank-arrow">→</span>' : ""}
      <div class="rank-node ${cls}"><span class="icon">${r.icon}</span><span class="label">${r.name}</span></div>`;
  }).join("");

  const templates = loadTemplates();
  $("#seal-grid").innerHTML = SEALS.map((s) => {
    const p = game.state.seals[s.id];
    return `<div class="seal-card ${p?.done ? "done" : ""}" data-seal="${s.id}">
      <span class="kanji">${s.kanji}</span>
      ${sealDiagram(s.id)}
      <div class="name">${s.emoji} ${s.name}</div>
      <div class="romaji">${s.romaji}</div>
      ${p?.best ? `<div class="best">best ${(p.best * 100).toFixed(0)}%</div>` : ""}
      ${templates[s.id] ? `<div class="cal-tag">calibrated</div>` : ""}
    </div>`;
  }).join("");

  $("#jutsu-list").innerHTML = JUTSUS.map((j) => {
    const unlocked = game.jutsuUnlocked(j);
    const p = game.state.jutsus[j.id];
    const seq = j.seq.map((id) => sealById(id).emoji).join("");
    return `<div class="jutsu-card ${unlocked ? "" : "locked"}" data-jutsu="${j.id}">
      <span class="grade ${p?.grade || ""}">${p?.grade || (unlocked ? "–" : "🔒")}</span>
      <div>
        <div class="jname">${j.name}<span class="romaji">${j.romaji}</span></div>
        <div class="blurb">${j.blurb}</div>
      </div>
      <span class="seq-preview" title="${j.seq.join(" → ")}">${seq}</span>
      <span class="jutsu-rank-tag">${j.rank}</span>
    </div>`;
  }).join("");
}

$("#seal-grid").addEventListener("click", (e) => {
  const card = e.target.closest("[data-seal]");
  if (card) startLesson(card.dataset.seal);
});

$("#jutsu-list").addEventListener("click", (e) => {
  const card = e.target.closest("[data-jutsu]");
  if (!card) return;
  const jutsu = JUTSUS.find((j) => j.id === card.dataset.jutsu);
  if (!game.jutsuUnlocked(jutsu)) {
    toast(`Reach ${jutsu.rank} rank to unlock this scroll 🔒`);
    return;
  }
  startJutsu(jutsu.id);
});

// ---------- Camera / drill plumbing ----------

async function ensureVision() {
  $("#cam-status").classList.remove("hidden");
  $("#cam-status").textContent = "Summoning chakra… (loading hand tracker + camera)";
  if (!engine) engine = new VisionEngine($("#video"), $("#overlay"));
  try {
    await engine.init();
    $("#cam-status").classList.add("hidden");
    return true;
  } catch (err) {
    $("#cam-status").textContent =
      err.name === "NotAllowedError"
        ? "Camera access denied — allow the camera to train."
        : `Could not start vision: ${err.message}`;
    return false;
  }
}

function setRing(progress, text) {
  $("#ring-fg").style.strokeDashoffset = RING_CIRC * (1 - Math.max(0, Math.min(1, progress)));
  $("#ring-text").textContent = text;
}

function setMeter(score) {
  const pct = Math.round(score * 100);
  const fill = $("#meter-fill");
  fill.style.width = `${pct}%`;
  fill.classList.toggle("hot", score >= LESSON.threshold);
  $("#meter-label").textContent = `${pct}%`;
}

function renderTargetSeal(seal, extra = "") {
  $("#target-card").innerHTML = `
    <h3>${seal.emoji} ${seal.name} <span class="kanji">${seal.kanji}</span>
      <span class="romaji">(${seal.romaji})</span></h3>
    ${sealDiagram(seal.id)}
    <p class="hint">${seal.hint}</p>${extra}`;
}

function stopDrill() {
  drill = null;
  engine?.stop();
  engine?.shutdown();
}

async function enterTrainScreen() {
  showScreen("train");
  const ok = await ensureVision();
  if (ok && drill) engine.start(onFrame);
  return ok;
}

// ---------- Frame handler (one loop, three drill types) ----------

function onFrame({ numHands, features }) {
  if (!drill) return;
  const now = performance.now();

  if (numHands < 2) {
    drill.smoothed = 0;
    setMeter(0);
    $("#drill-hint").textContent = "Bring both hands into frame 🙌";
    if (drill.type !== "calibrate") setRing(drill.baseProgress ?? 0, drill.ringLabel ?? "");
    return;
  }

  if (drill.type === "calibrate") return onCalibrateFrame(features, now);

  const seal = sealById(drill.type === "lesson" ? drill.sealId : drill.seq[drill.stepIdx]);
  const { score, calibrated } = scoreSeal(features, seal, drill.templates);
  drill.smoothed = drill.smoothed * 0.7 + score * 0.3;
  setMeter(drill.smoothed);
  drill.peak = Math.max(drill.peak ?? 0, drill.smoothed);
  $("#drill-hint").textContent =
    drill.smoothed >= drill.threshold
      ? "Hold it… ⚡"
      : `Match the ${seal.name} seal${calibrated ? "" : " (uncalibrated — Settings → Calibrate for better scoring)"}`;

  if (drill.smoothed >= drill.threshold) {
    drill.holdStart ??= now;
    const held = now - drill.holdStart;
    const progress = drill.baseProgress + (held / drill.holdMs) * drill.progressPerHold;
    setRing(progress, drill.ringLabel);
    if (held >= drill.holdMs) onHoldComplete();
  } else {
    drill.holdStart = null;
    setRing(drill.baseProgress, drill.ringLabel);
  }
}

function onHoldComplete() {
  if (drill.type === "lesson") {
    drill.repsDone += 1;
    drill.holdStart = null;
    drill.baseProgress = drill.repsDone / LESSON.reps;
    drill.ringLabel = `${drill.repsDone}/${LESSON.reps}`;
    if (drill.repsDone >= LESSON.reps) return finishLesson();
    toast(`Nice ${sealById(drill.sealId).name}! One more ✨`);
  } else {
    drill.peaks.push(drill.peak);
    drill.peak = 0;
    drill.holdStart = null;
    drill.smoothed = 0;
    drill.stepIdx += 1;
    drill.baseProgress = drill.stepIdx / drill.seq.length;
    drill.ringLabel = `${drill.stepIdx}/${drill.seq.length}`;
    if (drill.stepIdx >= drill.seq.length) return finishJutsu();
    renderJutsuStep();
  }
}

// ---------- Seal lesson ----------

async function startLesson(sealId) {
  const seal = sealById(sealId);
  drill = {
    type: "lesson",
    sealId,
    templates: loadTemplates(),
    threshold: LESSON.threshold,
    holdMs: LESSON.holdMs,
    repsDone: 0,
    smoothed: 0,
    peak: 0,
    holdStart: null,
    baseProgress: 0,
    progressPerHold: 1 / LESSON.reps,
    ringLabel: `0/${LESSON.reps}`,
  };
  $("#seq-strip").classList.add("hidden");
  renderTargetSeal(seal);
  setRing(0, drill.ringLabel);
  $("#drill-hint").textContent = "Form the seal and hold it steady.";
  await enterTrainScreen();
}

function finishLesson() {
  const { sealId, peak } = drill;
  const { xpGained, rankUp } = game.recordSealLesson(sealId, peak);
  drill = null;
  celebrate(`${sealById(sealId).emoji} ${sealById(sealId).name} mastered! +${xpGained} XP`, rankUp);
}

// ---------- Jutsu drill ----------

async function startJutsu(jutsuId) {
  const jutsu = JUTSUS.find((j) => j.id === jutsuId);
  drill = {
    type: "jutsu",
    jutsuId,
    seq: jutsu.seq,
    templates: loadTemplates(),
    threshold: JUTSU.threshold,
    holdMs: JUTSU.holdMs,
    stepIdx: 0,
    peaks: [],
    smoothed: 0,
    peak: 0,
    holdStart: null,
    baseProgress: 0,
    progressPerHold: 1 / jutsu.seq.length,
    ringLabel: `0/${jutsu.seq.length}`,
  };
  setRing(0, drill.ringLabel);
  renderJutsuStep();
  await enterTrainScreen();
}

function renderJutsuStep() {
  const strip = $("#seq-strip");
  strip.classList.remove("hidden");
  strip.innerHTML = drill.seq
    .map((id, i) => {
      const cls = i < drill.stepIdx ? "done" : i === drill.stepIdx ? "current" : "";
      return `<span class="step ${cls}" title="${sealById(id).name}">${sealById(id).emoji}</span>`;
    })
    .join("");
  if (drill.stepIdx < drill.seq.length) renderTargetSeal(sealById(drill.seq[drill.stepIdx]));
}

function finishJutsu() {
  const jutsu = JUTSUS.find((j) => j.id === drill.jutsuId);
  const avg = drill.peaks.reduce((s, v) => s + v, 0) / drill.peaks.length;
  const { grade, xpGained, rankUp } = game.recordJutsu(drill.jutsuId, avg);
  drill = null;
  celebrate(`${jutsu.name} complete — rank ${grade}! +${xpGained} XP`, rankUp);
}

function celebrate(message, rankUp) {
  stopDrill();
  showScreen("dojo");
  toast(message);
  if (rankUp) setTimeout(() => toast(`🎖️ Promoted to ${rankUp.name}!`), 2200);
}

// ---------- Calibration ----------

function renderCalibrateGrid() {
  const templates = loadTemplates();
  $("#calibrate-grid").innerHTML = SEALS.map(
    (s) => `<div class="seal-card" data-cal="${s.id}">
      <span class="kanji">${s.kanji}</span>
      ${sealDiagram(s.id)}
      <div class="name">${s.emoji} ${s.name}</div>
      ${templates[s.id] ? `<div class="cal-tag">calibrated ✓</div>` : `<div class="romaji">tap to record</div>`}
    </div>`,
  ).join("");
}

$("#calibrate-grid").addEventListener("click", async (e) => {
  const card = e.target.closest("[data-cal]");
  if (!card) return;
  const seal = sealById(card.dataset.cal);
  drill = { type: "calibrate", sealId: seal.id, frames: [], startAt: null };
  $("#seq-strip").classList.add("hidden");
  renderTargetSeal(seal, `<p class="hint"><strong>Calibration:</strong> form the seal, hold it, and keep it steady while the ring fills.</p>`);
  setRing(0, "ready?");
  $("#drill-hint").textContent = "Recording starts once both hands are visible.";
  await enterTrainScreen();
});

function onCalibrateFrame(features, now) {
  drill.startAt ??= now + 2000; // 2s to settle into the pose
  if (now < drill.startAt) {
    setRing(0, `${Math.ceil((drill.startAt - now) / 1000)}…`);
    $("#drill-hint").textContent = "Get into the seal…";
    return;
  }
  drill.frames.push(features.vec);
  setRing(drill.frames.length / CALIBRATION_FRAMES, "recording");
  $("#drill-hint").textContent = "Hold steady…";
  if (drill.frames.length >= CALIBRATION_FRAMES) {
    saveTemplate(drill.sealId, drill.frames);
    const seal = sealById(drill.sealId);
    drill = null;
    stopDrill();
    showScreen("settings");
    toast(`${seal.emoji} ${seal.name} calibrated ✓`);
  }
}

$("#clear-templates").addEventListener("click", () => {
  clearTemplates();
  renderCalibrateGrid();
  toast("Calibration cleared");
});

$("#reset-progress").addEventListener("click", async () => {
  if (!confirm("Reset all XP, seals and jutsu progress?")) return;
  await game.resetProgress();
  renderHeader();
  toast("Progress reset");
});

// ---------- Leaderboard ----------

async function renderLeaderboard() {
  const body = $("#board-body");
  try {
    const rows = await game.fetchLeaderboard();
    $("#board-empty").classList.toggle("hidden", rows.length > 0);
    const rankName = (id) => RANKS.find((r) => r.id === id)?.name ?? id;
    body.innerHTML = rows
      .map(
        (r, i) => `<tr><td>${i + 1}</td><td>${r.username}</td>
          <td>${rankName(r.rank)}</td><td>${r.xp}</td></tr>`,
      )
      .join("");
  } catch {
    body.innerHTML = "";
    $("#board-empty").classList.remove("hidden");
    $("#board-empty").textContent = "Leaderboard unavailable — is the server running?";
  }
}

// ---------- Auth ----------

const modal = $("#auth-modal");

$("#auth-button").addEventListener("click", () => {
  if (game.auth) {
    game.logout();
    renderHeader();
    toast("Logged out — training as guest");
  } else {
    $("#auth-error").textContent = "";
    modal.showModal();
  }
});

$("#auth-cancel").addEventListener("click", () => modal.close());

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const mode = e.submitter?.dataset.mode ?? "login";
  const username = $("#auth-username").value.trim();
  const password = $("#auth-password").value;
  try {
    await (mode === "register" ? game.register(username, password) : game.login(username, password));
    modal.close();
    renderDojo();
    toast(mode === "register" ? `Welcome to the village, ${username}! 🍥` : `Welcome back, ${username}!`);
  } catch (err) {
    $("#auth-error").textContent = err.message;
  }
});

// ---------- Toast ----------

let toastTimer = null;

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

// ---------- Boot ----------

renderDojo();
if (game.auth) game.pullProgress().then(renderDojo).catch(() => {});
