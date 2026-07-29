// Deployment config. BACKEND=true when served by the FastAPI app (accounts,
// progress sync, leaderboard). The static GitHub Pages deploy overwrites this
// file with BACKEND=false (see .github/workflows/deploy-pages.yml) — guest mode only.
export const BACKEND = true;
