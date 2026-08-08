# Mini Market Simulation

Educational browser stock-trading game. Modular Vite + vanilla ES modules build.

**Play:** [https://leaferd6712.github.io/mini-market-simulation/](https://leaferd6712.github.io/mini-market-simulation/)

## Deploy

GitHub Pages (static game) + laptop Python API / Cloudflare tunnel (shared leaderboard): **[DEPLOY.md](DEPLOY.md)**

Port **8788** for the leaderboard API (KartBlitz uses **8787**).

## Develop

```bash
cp .env.example .env   # VITE_LB_API_BASE=http://localhost:8788
npm install
npm run dev
```

In another terminal:

```bash
cd server
python app.py
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` (base `/mini-market-simulation/`) |
| `npm run preview` | Preview production build |
| `npm test` / `npm run test:run` | Vitest once |
| `server/start-leaderboard.bat` | Start API on 8788 (+ cloudflared if on PATH) |

## Architecture

- `src/data` — stocks, news, quests, achievements, levels
- `src/sim` — day loop, economy, trading, dividends, news generation
- `src/persist` — local save (v7) + local leaderboard
- `src/api` — global leaderboard client (`VITE_LB_API_BASE`)
- `server/` — laptop leaderboard API (SQLite)
- `src/game` — UI + boot

## Leaderboard

1. Run `python server/app.py` (port **8788**).
2. Expose with `cloudflared tunnel --url http://localhost:8788`.
3. Set `VITE_LB_API_BASE` to that URL and rebuild/redeploy Pages.
4. Client: `POST /api/submit-score`, `GET /api/leaderboard`.

Player names are sanitized (strip tags, alphanumeric + spaces/`_`/`-`/`'`.`, max 30) on client and server.

## Save format

Local saves use key `marketSim_v7_tilemode` (schema version 7). Legacy `marketSim_v6_tilemode` loads are migrated automatically.
