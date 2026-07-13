#!/usr/bin/env bash
# Deploy the frontend as a static GitHub Pages site → https://divyashivaram.in/jutsu/
# Mirrors frontend/ into the divyashivaram/jutsu repo (Pages: main branch, root)
# with BACKEND flipped off (guest mode only — no accounts/leaderboard).
set -euo pipefail

REPO="divyashivaram/jutsu"
SRC="$(cd "$(dirname "$0")/.." && pwd)/frontend"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

gh repo clone "$REPO" "$WORK/site" -- --quiet --depth 1

rsync -a --delete --exclude ".git" --exclude "README.md" "$SRC/" "$WORK/site/"

cat > "$WORK/site/scripts/config.js" <<'EOF'
// Static GitHub Pages deploy — no backend. Written by scripts/deploy-pages.sh;
// do not edit here, the source of truth is the jutsu_master repo.
export const BACKEND = false;
EOF

cat > "$WORK/site/README.md" <<'EOF'
# Jutsu Master (static deploy)

Live at https://divyashivaram.in/jutsu/ — a vision-based Naruto hand-seal
trainer. All hand tracking runs in-browser (MediaPipe HandLandmarker); no
video leaves the machine. Progress is stored in localStorage.

**Do not edit this repo directly.** It is a build artifact: the source lives
in the private `jutsu_master` repo and is mirrored here by
`scripts/deploy-pages.sh`.
EOF

cd "$WORK/site"
if git status --porcelain | grep -q .; then
  git add -A
  git commit --quiet -m "deploy: sync from jutsu_master $(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo local)"
  git push --quiet -u origin HEAD
  echo "Deployed. Pages will rebuild https://divyashivaram.in/jutsu/ shortly."
else
  echo "No changes to deploy."
fi
