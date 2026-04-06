"""
Verifier: memory-write-read
Checks that the agent correctly wrote and read back a trace event
with proper tenant isolation.

Reward breakdown:
  0.4 — event inserted with correct fields
  0.3 — event read back (query returns the row)
  0.3 — tenant isolation (cross-tenant query returns 0 rows)
"""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get("DATABASE_URL", "")
LOGS_DIR = "/logs"
REWARD_FILE = f"{LOGS_DIR}/reward.txt"

def write_reward(score: float, reason: str):
    os.makedirs(LOGS_DIR, exist_ok=True)
    with open(REWARD_FILE, "w") as f:
        f.write(str(round(score, 4)))
    print(f"[verifier] reward={score:.4f} reason={reason}")

def main():
    if not DATABASE_URL:
        write_reward(0.0, "DATABASE_URL not set")
        return

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
    except Exception as e:
        write_reward(0.0, f"DB connection failed: {e}")
        return

    score = 0.0
    reasons = []

    try:
        # Check 1: event inserted with correct fields (0.4)
        cur.execute("""
            SELECT id, event_type, group_id, agent_id, status, metadata
            FROM events
            WHERE group_id = 'allura-test'
              AND event_type = 'TASK_COMPLETE'
              AND agent_id = 'memory-builder'
              AND metadata::text LIKE '%benchmark-write-read%'
            ORDER BY created_at DESC
            LIMIT 1
        """)
        row = cur.fetchone()

        if row:
            score += 0.4
            reasons.append("insert:ok")

            # Check 2: metadata is valid JSON with expected key (0.3)
            try:
                meta = row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"])
                if meta.get("task") == "benchmark-write-read":
                    score += 0.3
                    reasons.append("metadata:ok")
                else:
                    reasons.append("metadata:wrong-value")
            except Exception:
                reasons.append("metadata:parse-error")
        else:
            reasons.append("insert:missing")

        # Check 3: tenant isolation — cross-tenant query returns 0 rows (0.3)
        cur.execute("""
            SELECT COUNT(*) as cnt
            FROM events
            WHERE group_id = 'allura-OTHER'
              AND event_type = 'TASK_COMPLETE'
              AND metadata::text LIKE '%benchmark-write-read%'
        """)
        isolation_row = cur.fetchone()
        cross_count = isolation_row["cnt"] if isolation_row else 1

        if cross_count == 0:
            score += 0.3
            reasons.append("isolation:ok")
        else:
            reasons.append(f"isolation:leaked({cross_count})")

        # Penalty: check for any UPDATE/DELETE violations (append-only invariant)
        # We can't easily detect this from outside, but we verify no rows were deleted
        cur.execute("""
            SELECT COUNT(*) as cnt FROM events
            WHERE group_id = 'allura-test'
        """)
        total = cur.fetchone()
        if total and total["cnt"] == 0 and row:
            score = max(0.0, score - 0.5)
            reasons.append("penalty:rows-deleted")

    except Exception as e:
        reasons.append(f"error:{e}")
    finally:
        cur.close()
        conn.close()

    write_reward(score, " | ".join(reasons))

if __name__ == "__main__":
    main()
