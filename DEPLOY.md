# Deploy Mini Market Simulation

Static game on **GitHub Pages**. Shared (global) leaderboard runs on **your laptop** via Python + a Cloudflare quick tunnel — same idea as KartBlitz, but on **port 8788** so KartBlitz can keep using **8787**.

Live game URL (example):  
`https://leaferd6712.github.io/mini-market-simulation/`

Scores only sync while the laptop API + tunnel are running.

---

## What you need

- Node.js 20+ (to build/deploy the game)
- Python 3 on PATH (`python --version`)
- `cloudflared` (e.g. `C:\Users\663208\Downloads\Applications\cloudflared-windows-amd64.exe`)
- This repo, especially [`server/app.py`](server/app.py)

---

## 1. One-time: GitHub Pages

1. Push to GitHub (`main`).
2. Repo **Settings** → **Pages** → Source = **GitHub Actions**.
3. Add Actions secret (optional until you have a tunnel URL):

| Secret | Value |
|--------|--------|
| `VITE_LB_API_BASE` | Your current tunnel URL, e.g. `https://something.trycloudflare.com` (no trailing slash) |

The workflow builds Vite with that env var baked into the client.

---

## 2. Every time you want the shared leaderboard online

### 2.1 Start the API (port 8788)

```bat
cd C:\Users\663208\Downloads\mini-market-simulation\server
python app.py
```

Or double-click [`server/start-leaderboard.bat`](server/start-leaderboard.bat) (starts API + tries to start cloudflared).

Leave the window open. You should see:

```text
Mini Market leaderboard serving on http://localhost:8788
```

Check: http://localhost:8788/api/health → `{"ok": true, "service": "mini-market-leaderboard", "port": 8788}`

### 2.2 Start the Cloudflare tunnel

Second Command Prompt:

```bat
"C:\Users\663208\Downloads\Applications\cloudflared-windows-amd64.exe" tunnel --url http://localhost:8788
```

Copy the URL from **Your quick Tunnel has been created!**, for example:

```text
https://casinos-theaters-agencies-boards.trycloudflare.com
```

Leave this window open too.

### 2.3 Point the game at the tunnel URL

1. Set locally and/or as GitHub secret:

```env
VITE_LB_API_BASE=https://YOUR-CURRENT-TUNNEL-URL
```

2. Rebuild and redeploy Pages (`git push` to `main`, or run the workflow manually).

Quick tunnel URLs change each time you restart `cloudflared`. When the URL changes, update `VITE_LB_API_BASE` and redeploy.

Skip redeploy only if the baked URL already matches today’s tunnel.

### 2.4 Play / share

- Share the **GitHub Pages** game URL.
- Global leaderboard works while both laptop windows stay open.
- If Global shows offline / not configured, the API or tunnel is down, or `VITE_LB_API_BASE` is wrong.

---

## Keep both windows open

| Window | Role |
|--------|------|
| `python app.py` | Stores scores in `server/scores.db` on **8788** |
| `cloudflared ... 8788` | Lets the internet reach your laptop |

Also:

- Keep the laptop **plugged in and awake** (sleep kills the board).
- Closing either window = shared leaderboard goes offline (Pages game still loads; local browser leaderboard still works).

**Port reminder:** KartBlitz = **8787**, Mini Market = **8788**.

---

## Local game + local API (no tunnel)

```bat
cd C:\Users\663208\Downloads\mini-market-simulation
copy .env.example .env
npm install
npm run dev
```

With `VITE_LB_API_BASE=http://localhost:8788` and `python server/app.py` running, Global submit works from the Vite dev server without cloudflared.

---

## Deploy the static site only

```bash
git push origin main
```

Or **Actions** → **Deploy static content to Pages** → **Run workflow**.

```bash
npm test
npm run build
npm run preview
```

---

## Useful checks

| Check | URL |
|-------|-----|
| Local API | http://localhost:8788/api/health |
| Public API (tunnel) | `https://YOUR-TUNNEL-URL/api/health` |

Both should return `{"ok": true, ...}`.

---

## Stopping

`Ctrl+C` in each Command Prompt, or close the windows.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port in use | Something else on 8788; stop it or change `PORT` in `server/app.py` |
| Global offline on Pages | Update `VITE_LB_API_BASE` secret to today’s tunnel URL and redeploy |
| CORS / network errors | Confirm tunnel points at **8788**, not 8787 |
| KartBlitz conflict | Unrelated — KartBlitz stays on 8787 |

---

## Quick checklist

- [ ] Pages source = GitHub Actions  
- [ ] `python server/app.py` on **8788**  
- [ ] `cloudflared tunnel --url http://localhost:8788`  
- [ ] `VITE_LB_API_BASE` = current tunnel URL  
- [ ] Pages rebuild after URL change  
- [ ] Health check OK via tunnel  
- [ ] Submit a score from the live game  
