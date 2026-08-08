"""Mini Market Simulation shared leaderboard API (stdlib only).

Runs on port 8788 so KartBlitz can keep using 8787 at the same time.
"""

from __future__ import annotations

import json
import re
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

DB_PATH = Path(__file__).resolve().parent / "scores.db"
PORT = 8788
TOP_N = 50
NAME_MAX = 30
NAME_RE = re.compile(r"[^a-zA-Z0-9 _\-'.]")

# In-memory rate limit: max submissions per key per window
RATE_LIMIT = 20
RATE_WINDOW_S = 60
_rate_map: dict[str, dict[str, float | int]] = {}


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS leaderboard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT NOT NULL,
                player_key TEXT NOT NULL UNIQUE,
                score REAL NOT NULL DEFAULT 0,
                day INTEGER NOT NULL DEFAULT 0,
                level INTEGER NOT NULL DEFAULT 1,
                updated_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC)"
        )


def sanitize_player_name(raw: object) -> str:
    s = str(raw or "")
    s = re.sub(r"<[^>]*>", "", s)
    s = re.sub(r"&[#a-zA-Z0-9]+;", "", s)
    s = NAME_RE.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > NAME_MAX:
        s = s[:NAME_MAX].strip()
    return s


def clamp_score(score: object) -> float:
    try:
        n = float(score)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    if n != n:  # NaN
        return 0.0
    return max(0.0, min(1e12, n))


def clamp_day(day: object) -> int:
    try:
        n = int(float(day))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0
    return max(0, min(10000, n))


def clamp_level(level: object) -> int:
    try:
        n = int(float(level))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 1
    return max(1, min(4, n))


def rate_limit(key: str, limit: int = RATE_LIMIT, window_s: int = RATE_WINDOW_S) -> bool:
    now = time.time()
    entry = _rate_map.get(key)
    if not entry or now > float(entry["reset"]):
        _rate_map[key] = {"count": 1, "reset": now + window_s}
        return True
    count = int(entry["count"]) + 1
    entry["count"] = count
    return count <= limit


def compute_rank(conn: sqlite3.Connection, score: float) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM leaderboard WHERE score > ?",
        (score,),
    ).fetchone()
    return int(row["c"]) + 1


def list_scores(conn: sqlite3.Connection, limit: int = TOP_N) -> list[dict]:
    rows = conn.execute(
        """
        SELECT player_name, score, day, level, updated_at
        FROM leaderboard
        ORDER BY score DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [
        {
            "player_name": r["player_name"],
            "score": r["score"],
            "day": r["day"],
            "level": r["level"],
        }
        for r in rows
    ]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _client_ip(self) -> str:
        forwarded = self.headers.get("CF-Connecting-IP") or self.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return self.client_address[0] if self.client_address else "unknown"

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "mini-market-leaderboard",
                    "port": PORT,
                },
            )
            return

        if path == "/api/leaderboard":
            qs = parse_qs(parsed.query)
            try:
                limit = min(max(int(qs.get("limit", [str(TOP_N)])[0]), 1), 100)
            except ValueError:
                limit = TOP_N
            name_q = (qs.get("name", [""])[0] or "").strip()

            with get_db() as conn:
                top = list_scores(conn, limit)
                total_row = conn.execute("SELECT COUNT(*) AS c FROM leaderboard").fetchone()
                total = int(total_row["c"])
                player_rank = None
                if name_q:
                    key = name_q.lower()
                    row = conn.execute(
                        "SELECT score FROM leaderboard WHERE player_key = ?",
                        (key,),
                    ).fetchone()
                    if row:
                        player_rank = compute_rank(conn, float(row["score"]))

            self._send_json(
                200,
                {
                    "top10": top[:10],
                    "entries": top,
                    "playerRank": player_rank,
                    "total": total,
                },
            )
            return

        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/api/submit-score":
            self._send_json(404, {"error": "not found"})
            return

        ip = self._client_ip()
        if not rate_limit(f"ip:{ip}"):
            self._send_json(429, {"error": "Rate limit exceeded"})
            return

        data = self._read_json()
        player_name = sanitize_player_name(data.get("player_name"))
        if not player_name:
            self._send_json(400, {"error": "Invalid player_name"})
            return

        if not rate_limit(f"name:{player_name.lower()}", limit=10):
            self._send_json(429, {"error": "Rate limit exceeded"})
            return

        score = clamp_score(data.get("score"))
        day = clamp_day(data.get("day"))
        level = clamp_level(data.get("level"))
        player_key = player_name.lower()
        now = int(time.time())

        with get_db() as conn:
            existing = conn.execute(
                "SELECT id, score FROM leaderboard WHERE player_key = ?",
                (player_key,),
            ).fetchone()

            effective_score = score
            if not existing:
                conn.execute(
                    """
                    INSERT INTO leaderboard (player_name, player_key, score, day, level, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (player_name, player_key, score, day, level, now),
                )
            elif score > float(existing["score"]):
                conn.execute(
                    """
                    UPDATE leaderboard
                    SET player_name = ?, score = ?, day = ?, level = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (player_name, score, day, level, now, existing["id"]),
                )
            else:
                effective_score = float(existing["score"])

            rank = compute_rank(conn, effective_score)

        self._send_json(
            200,
            {
                "rank": rank,
                "score": effective_score,
                "player_name": player_name,
            },
        )


def main() -> None:
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Mini Market leaderboard serving on http://localhost:{PORT}")
    print("Health check: http://localhost:%s/api/health" % PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
