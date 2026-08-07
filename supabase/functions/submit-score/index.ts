// Supabase Edge Function: submit-score
// Mirrors client sanitize rules from src/utils/sanitize.js
// Requires secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitizePlayerName(name: unknown): string {
  let s = String(name ?? '');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/&[#a-zA-Z0-9]+;/g, '');
  s = s.replace(/[^a-zA-Z0-9 _\-'.]/g, '');
  s = s.trim().replace(/\s+/g, ' ');
  if (s.length > 30) s = s.slice(0, 30).trim();
  return s;
}

function clampScore(score: unknown): number {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1e12, Math.round(n * 100) / 100));
}

function clampDay(day: unknown): number {
  const n = Math.floor(Number(day));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10000, n));
}

function clampLevel(level: unknown): number {
  const n = Math.floor(Number(level));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(4, n));
}

/** In-memory IP rate limit: max 10 submissions / minute */
const rateMap = new Map<string, { count: number; reset: number }>();

function rateLimit(ip: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';

  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const player_name = sanitizePlayerName(body.player_name ?? body.name);
  if (!player_name) {
    return new Response(JSON.stringify({ error: 'Invalid player name' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const score = clampScore(body.score);
  const day = clampDay(body.day);
  const level = clampLevel(body.level);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const headers = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Prefer: 'return=representation',
  };

  // Lookup existing by name (case-insensitive via ilike exact)
  const encoded = encodeURIComponent(player_name);
  const existingRes = await fetch(
    `${supabaseUrl}/rest/v1/leaderboard?player_name=eq.${encoded}&select=id,score&order=score.desc&limit=1`,
    { headers }
  );

  if (!existingRes.ok) {
    return new Response(JSON.stringify({ error: 'Lookup failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const existingRows = await existingRes.json();
  const existing = existingRows[0] || null;
  let effectiveScore = score;

  if (!existing) {
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/leaderboard`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ player_name, score, day, level }),
    });
    if (!insertRes.ok) {
      return new Response(JSON.stringify({ error: 'Insert failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else if (score > Number(existing.score || 0)) {
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/leaderboard?id=eq.${existing.id}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ score, day, level }),
      }
    );
    if (!updateRes.ok) {
      return new Response(JSON.stringify({ error: 'Update failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    effectiveScore = Number(existing.score || score);
  }

  // Rank among unique best scores
  const rankRes = await fetch(
    `${supabaseUrl}/rest/v1/leaderboard?select=player_name,score&order=score.desc`,
    { headers }
  );
  if (!rankRes.ok) {
    return new Response(JSON.stringify({ ok: true, rank: null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const allRows = await rankRes.json();
  const seen = new Set<string>();
  const deduped: { player_name: string; score: number }[] = [];
  for (const row of allRows) {
    const key = (row.player_name || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  const higher = deduped.filter((r) => Number(r.score || 0) > effectiveScore).length;
  const rank = higher + 1;

  return new Response(JSON.stringify({ ok: true, rank, score: effectiveScore }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
