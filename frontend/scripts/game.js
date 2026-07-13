// Progress state, rank logic, XP, and server sync.
// localStorage-first (guest play works offline); synced to the API when logged in.

import { JUTSUS, RANKS, SEALS, XP, jutsusForRank } from "./data.js";

const STATE_KEY = "jutsu.progress.v1";
const AUTH_KEY = "jutsu.auth.v1";

const emptyState = () => ({ xp: 0, rank: "academy", seals: {}, jutsus: {} });

export const state = loadLocal();
export let auth = loadAuth();

function loadLocal() {
  try {
    return { ...emptyState(), ...JSON.parse(localStorage.getItem(STATE_KEY)) };
  } catch {
    return emptyState();
  }
}

function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch {
    return null;
  }
}

function persistLocal() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// ---- API ----

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  const resp = await fetch(path, { ...options, headers });
  if (!resp.ok) {
    const detail = (await resp.json().catch(() => ({}))).detail;
    throw new Error(detail || `Request failed (${resp.status})`);
  }
  return resp.json();
}

export async function register(username, password) {
  const body = JSON.stringify({ username, password });
  const data = await api("/api/register", { method: "POST", body });
  auth = data;
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  await pushProgress(); // carry guest progress into the new account
}

export async function login(username, password) {
  const body = JSON.stringify({ username, password });
  const data = await api("/api/login", { method: "POST", body });
  auth = data;
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  await pullProgress();
}

export function logout() {
  auth = null;
  localStorage.removeItem(AUTH_KEY);
}

export async function pullProgress() {
  if (!auth) return;
  const remote = await api("/api/progress");
  if (remote.xp >= state.xp) Object.assign(state, remote);
  persistLocal();
}

let pushTimer = null;

export function pushProgress() {
  persistLocal();
  if (!auth) return Promise.resolve();
  clearTimeout(pushTimer);
  return new Promise((resolve) => {
    pushTimer = setTimeout(async () => {
      try {
        await api("/api/progress", { method: "PUT", body: JSON.stringify(state) });
      } catch (e) {
        console.warn("progress sync failed:", e.message);
      }
      resolve();
    }, 400);
  });
}

export function fetchLeaderboard() {
  return api("/api/leaderboard");
}

// ---- Progression rules ----

export function rankIndex(rankId = state.rank) {
  return RANKS.findIndex((r) => r.id === rankId);
}

export function sealDone(id) {
  return !!state.seals[id]?.done;
}

export function jutsuDone(id) {
  return !!state.jutsus[id]?.done;
}

export function tierComplete(rankId) {
  if (rankId === "academy") return SEALS.every((s) => sealDone(s.id));
  return jutsusForRank(rankId).every((j) => jutsuDone(j.id));
}

// A jutsu is unlocked when its rank has been reached.
export function jutsuUnlocked(jutsu) {
  return rankIndex(jutsu.rank) <= rankIndex();
}

function maybeRankUp() {
  const idx = rankIndex();
  if (idx < RANKS.length - 1 && tierComplete(state.rank)) {
    state.rank = RANKS[idx + 1].id;
    return RANKS[idx + 1];
  }
  return null;
}

export function recordSealLesson(sealId, bestScore) {
  const entry = state.seals[sealId] || { best: 0, attempts: 0, done: false };
  entry.attempts += 1;
  entry.best = Math.max(entry.best, +bestScore.toFixed(3));
  const firstTime = !entry.done;
  entry.done = true;
  state.seals[sealId] = entry;
  if (firstTime) state.xp += XP.sealLesson;
  const rankUp = maybeRankUp();
  pushProgress();
  return { xpGained: firstTime ? XP.sealLesson : 0, rankUp };
}

export function gradeFor(avgScore) {
  if (avgScore >= 0.92) return "S";
  if (avgScore >= 0.85) return "A";
  if (avgScore >= 0.75) return "B";
  return "C";
}

const GRADE_ORDER = { S: 4, A: 3, B: 2, C: 1 };

export function recordJutsu(jutsuId, avgScore) {
  const jutsu = JUTSUS.find((j) => j.id === jutsuId);
  const grade = gradeFor(avgScore);
  const entry = state.jutsus[jutsuId] || { grade: null, attempts: 0, done: false };
  entry.attempts += 1;
  const firstTime = !entry.done;
  entry.done = true;
  if (!entry.grade || GRADE_ORDER[grade] > GRADE_ORDER[entry.grade]) entry.grade = grade;
  state.jutsus[jutsuId] = entry;
  const xpGained = firstTime ? XP.jutsu[jutsu.rank] : Math.round(XP.jutsu[jutsu.rank] / 5);
  state.xp += xpGained;
  const rankUp = maybeRankUp();
  pushProgress();
  return { grade, xpGained, rankUp };
}

export function resetProgress() {
  Object.assign(state, emptyState());
  persistLocal();
  return pushProgress();
}
