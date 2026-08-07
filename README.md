# Mini Market Simulation

Educational browser stock-trading game. Modular Vite + vanilla ES modules build.

**Play:** [https://leaferd6712.github.io/mini-market-simulation/](https://leaferd6712.github.io/mini-market-simulation/)

## Deploy

Step-by-step GitHub Pages + Supabase instructions: **[DEPLOY.md](DEPLOY.md)**

## Develop

```bash
cp .env.example .env   # already has public Supabase URL/anon key if using the default project
npm install
npm run dev
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` (base `/mini-market-simulation/`) |
| `npm run preview` | Preview production build |
| `npm test` / `npm run test:run` | Vitest once |

## Architecture

- `src/data` — stocks, news, quests, achievements, levels
- `src/sim` — day loop, economy, trading, dividends, news generation
- `src/persist` — local save (v7) + local leaderboard
- `src/api` — global leaderboard (REST read; Edge Function write)
- `src/ui` — render, modals, charts, audio, a11y
- `src/game` — loop + boot/init

## Leaderboard / Supabase

1. Apply `supabase/migrations/001_leaderboard_rls.sql` (revokes anon insert/update; keeps public select).
2. Deploy `supabase/functions/submit-score` with service role secrets.
3. Client submits scores only to `${VITE_SUPABASE_URL}/functions/v1/submit-score`.
4. Client reads via REST GET on `leaderboard`.

Player names are sanitized (strip tags, alphanumeric + spaces/`_`/`-`, max 30) on client and in the Edge Function.

## Save format

Local saves use key `marketSim_v7_tilemode` (schema version 7). Legacy `marketSim_v6_tilemode` loads are migrated automatically.
