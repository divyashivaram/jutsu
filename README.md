# 術 Jutsu Master

Perfect your Naruto hand seals with your webcam. In-browser hand tracking (MediaPipe)
scores how well you form each of the 12 seals, then drills you through real jutsu
sequences — Fireball, Chidori, Water Dragon — with Duolingo-style progression from
Academy Student to Kage. Video never leaves your browser.

## Run

```sh
uv sync
uv run uvicorn --factory jutsu_master.app:create_app --port 8110
# open http://127.0.0.1:8110  (allow the camera; first load fetches the hand model from CDN)
```

Train as guest, or register a ninja name to sync progress and join the leaderboard.
Tip: Settings → Calibration records your own hands per seal and makes scoring much sharper.

## Develop

```sh
uv run pytest && uv run ruff check . && uv run mypy src/ tests/
```

See `CLAUDE.md` for architecture and conventions.
