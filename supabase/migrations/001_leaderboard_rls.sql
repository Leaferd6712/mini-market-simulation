-- Leaderboard table hardening: revoke direct anon/authenticated writes.
-- Score inserts/updates must go through the submit-score Edge Function (service role).
-- Keep SELECT open so the client can read the global leaderboard via REST GET.

-- Ensure table exists (no-op if already created)
create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  score numeric not null default 0,
  day integer not null default 0,
  level integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

-- Drop permissive write policies if present
drop policy if exists "Allow anon insert" on public.leaderboard;
drop policy if exists "Allow anon update" on public.leaderboard;
drop policy if exists "Allow authenticated insert" on public.leaderboard;
drop policy if exists "Allow authenticated update" on public.leaderboard;
drop policy if exists "leaderboard_insert_anon" on public.leaderboard;
drop policy if exists "leaderboard_update_anon" on public.leaderboard;

-- Revoke direct write privileges from anon / authenticated
revoke insert, update, delete on public.leaderboard from anon, authenticated;

-- Allow public read (anon + authenticated)
grant select on public.leaderboard to anon, authenticated;

-- Read policy for RLS
drop policy if exists "leaderboard_select_public" on public.leaderboard;
create policy "leaderboard_select_public"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

-- Note: service_role bypasses RLS and is used only by the Edge Function.
