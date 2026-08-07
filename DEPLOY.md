# Deploy Mini Market Simulation

This guide covers deploying the educational stock game to **GitHub Pages**, plus the optional **Supabase** setup for the global leaderboard.

Live URL (after Pages is enabled):  
`https://<your-github-username>.github.io/mini-market-simulation/`

---

## Prerequisites

- Node.js **20+** and npm
- A GitHub repository (this project)
- (Optional, for global leaderboard) A free [Supabase](https://supabase.com) project and the [Supabase CLI](https://supabase.com/docs/guides/cli)

---

## 1. One-time: enable GitHub Pages

1. Push this repo to GitHub (default branch: `main`).
2. Open the repo on GitHub → **Settings** → **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Do **not** use “Deploy from a branch” — the workflow builds Vite output into `dist/` and uploads that.

The workflow file is [`.github/workflows/static.yml`](.github/workflows/static.yml). It runs on every push to `main` and via **Actions → Deploy static content to Pages → Run workflow**.

---

## 2. Configure build secrets (recommended)

Vite bakes `VITE_*` values into the client at **build** time. Add these as repository secrets so CI can build a working leaderboard:

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Create:

| Secret name | Value |
|-------------|--------|
| `VITE_SUPABASE_URL` | Your project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project **anon public** key (Settings → API) |

The anon key is designed to be public in the browser. Score **writes** go through an Edge Function with the service role (never put the service role in `VITE_*` or client code).

If these secrets are missing, the game still deploys; local save and play work, but global leaderboard submit/read will be disabled until configured.

---

## 3. Deploy the static site

### Automatic (usual path)

```bash
git add -A
git commit -m "Your message"
git push origin main
```

Then:

1. Open **Actions** and wait for **Deploy static content to Pages** to finish (green).
2. Visit `https://<username>.github.io/mini-market-simulation/`  
   (first deploy can take a minute after the workflow completes.)

### Manual workflow run

GitHub → **Actions** → **Deploy static content to Pages** → **Run workflow**.

### What the workflow does

1. `npm ci`
2. `npm test`
3. `npm run build` → `dist/` (asset base `/mini-market-simulation/`)
4. Upload **only** `dist/` to GitHub Pages (legacy HTML / notes are not published)

### Local production check (optional)

```bash
cp .env.example .env   # edit if needed
npm install
npm test
npm run build
npm run preview
```

Open the preview URL Vite prints. Paths assume the app is served under `/mini-market-simulation/`.

---

## 4. Supabase: global leaderboard (optional but recommended)

Without this, players can still use the **local** (browser) leaderboard. Global submit needs a table, RLS, and the Edge Function.

### 4.1 Create the table + RLS

1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste and run the full contents of [`supabase/migrations/001_leaderboard_rls.sql`](supabase/migrations/001_leaderboard_rls.sql).

That script:

- Creates `public.leaderboard` if needed  
- Enables RLS  
- Allows **public SELECT**  
- **Revokes** direct `INSERT` / `UPDATE` / `DELETE` from `anon` and `authenticated`  
- Leaves writes to the Edge Function (service role)

### 4.2 Deploy the `submit-score` Edge Function

Install and log in to the CLI if you have not already:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

Deploy:

```bash
supabase functions deploy submit-score
```

Set secrets used by the function (service role stays server-side):

```bash
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Get the service role key from Dashboard → **Project Settings** → **API** → **service_role** (secret). Never commit it or expose it as a `VITE_` variable.

### 4.3 Confirm client env

Local `.env` (and GitHub Actions secrets) should match:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Client behaviour:

- **Read** ranks: REST `GET` on `/rest/v1/leaderboard`
- **Submit** scores: `POST` to `/functions/v1/submit-score` only

### 4.4 Smoke-test leaderboard

1. Play locally or on Pages, reach a score, open **Leaderboard**.
2. **Submit My Score** with a simple name (letters/numbers; max 30 chars).
3. Switch to **Global** and confirm the entry appears.
4. In Supabase → **Table Editor** → `leaderboard`, confirm the row.

If submit fails with 401/403, check Edge Function deploy and secrets.  
If submit works but direct table inserts from the browser still work, re-run the RLS migration (anon writes should be blocked).

---

## 5. Changing the GitHub repo name / URL path

Vite `base` is set to `/mini-market-simulation/` in [`vite.config.js`](vite.config.js).

If the GitHub repo is renamed, update:

1. `base` in `vite.config.js` to `/<new-repo-name>/`
2. Any README / docs URLs
3. Redeploy (`git push` or manual workflow)

For a custom domain at the site root, set `base: '/'` and configure DNS + Pages custom domain.

---

## 6. Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| 404 on Pages | Pages source must be **GitHub Actions**; wait for the latest successful deploy |
| Blank page / wrong asset paths | Confirm `base` matches the repo name path |
| Global leaderboard “not configured” | Set `VITE_SUPABASE_*` secrets and rebuild |
| Score submit fails | Deploy `submit-score`, set function secrets, check browser Network tab |
| Anyone can POST scores into the table | Re-apply RLS migration; revoke anon insert/update |
| CI fails on `npm ci` | Commit `package-lock.json`; use Node 20+ |

---

## 7. Security notes (short)

- The **anon** key in the frontend is expected.
- The **service role** key must only live in Supabase Edge Function secrets.
- Names are sanitized; scores are clamped and lightly rate-limited in the function.
- Without full replay verification, determined cheating is still possible — acceptable for this educational demo.

---

## Quick checklist

- [ ] Pages source = GitHub Actions  
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set as Actions secrets  
- [ ] Push to `main` (or run workflow manually) succeeds  
- [ ] Site loads at `https://<user>.github.io/mini-market-simulation/`  
- [ ] SQL migration applied  
- [ ] `submit-score` function deployed + secrets set  
- [ ] Global score submit smoke-tested  
