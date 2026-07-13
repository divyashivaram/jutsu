# Jutsu Master

Vision-based Naruto hand-seal trainer. FastAPI backend (accounts, progress, leaderboard,
SQLite) serves a plain HTML/CSS/JS frontend that does all hand tracking **in-browser** with
MediaPipe HandLandmarker — no video ever reaches the server. Gamified Duolingo-style
progression: Academy Student → Genin → Chunin → Jonin → Kage.

## Development commands

```sh
uv sync                                                    # install
uv run uvicorn --factory jutsu_master.app:create_app --port 8110 --reload
open http://127.0.0.1:8110                                 # app (camera needs localhost or HTTPS)
```

## Quality gates (all must pass before a task is "done")

```sh
uv run ruff check .
uv run ruff format --check .
uv run mypy src/ tests/
uv run pytest
```

## Architecture

- `src/jutsu_master/app.py` — `create_app(db_path)` factory; API under `/api/*`, `/health`,
  and a `StaticFiles` mount of `frontend/` at `/`. Token auth (bearer, stored per user).
- `src/jutsu_master/db.py` — sqlite3, schema bootstrap. DB defaults to `data/jutsu.db`
  (gitignored); tests use `tmp_path`.
- `frontend/scripts/data.js` — the 12 seals (with heuristic feature signatures), 6 jutsus,
  ranks, XP rules. Content lives here — add jutsus/seals in this one file.
- `frontend/scripts/config.js` — `BACKEND` flag; the static deploy overwrites it to false,
  which hides login + leaderboard (guest mode only).
- `frontend/scripts/diagrams.js` — schematic SVG seal diagrams; exports per-seal `LAYOUTS`
  (hand poses) shared with `ghost.js`, plus `foldPose`/`sealDiagramFrame` for the learn-mode
  fold animation (tested in `tests/diagrams.test.mjs`).
- `frontend/scripts/ghost.js` — parametric 21-landmark "ghost" target hands per seal, drawn
  on the camera as dashed magenta skeletons with a dark halo, anchored lower-center via
  `ghostPlacement` (never warm tones or frame-center — that's where face/skin sits).
  Pure geometry — tested via `node --test tests/*.test.mjs` (run alongside the gates).
- `frontend/scripts/vision.js` — camera + MediaPipe (CDN: jsdelivr wasm + Google-hosted
  model, so first load needs internet), 14-dim feature extraction (finger extensions ×10,
  palm gap, vertical offset, crossedness, flatness), heuristic + template classifier.
- `frontend/scripts/game.js` — progress state, rank-up rules, XP, localStorage-first with
  debounced sync to the API when logged in (guest mode works fully offline).
- `frontend/scripts/main.js` — screens, drill loop (seal lesson / jutsu sequence /
  calibration), learn mode (animated fold demo; every seal/jutsu card opens it first,
  "Start test" launches the drill), celebration overlay (accuracy % over the live camera
  on completion), auth modal, leaderboard.

## Static deploy (divyashivaram.in/jutsu)

`scripts/deploy-pages.sh` mirrors `frontend/` into the public `divyashivaram/jutsu` repo
(GitHub Pages, main branch, root — the divyashivaram.github.io CNAME puts project sites
under divyashivaram.in) with `config.js` rewritten to `BACKEND = false`. That repo is a
build artifact — never edit it directly. Re-run the script after any frontend change.

## Conventions & decisions

- **Port 8110** (house rule: never 8000 or 3000–3999). No Docker: single process + SQLite,
  no extra services.
- Seal signatures in `data.js` are approximations; **calibration** (Settings → tap a seal,
  hold it, 45 frames recorded) stores per-device templates in localStorage which take
  precedence over heuristics. When tuning detection, prefer improving calibration UX over
  hand-tweaking signatures.
- Score thresholds live at the top of `main.js` (`LESSON`, `JUTSU`); grading S/A/B/C in
  `game.js:gradeFor`.
- Passwords: PBKDF2-HMAC-SHA256, per-user salt. One active token per user (login rotates it).
