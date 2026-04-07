"""
Verifier: group-id-isolation
Directly queries PostgreSQL to verify the agent enforced tenant isolation correctly.

Reward breakdown:
  0.30 — Agent wrote a row with group_id = 'allura-test'
  0.30 — Cross-tenant query returns 0 rows (no leak to allura-other)
  0.25 — Schema rejects insert without group_id (constraint error raised)
  0.15 — All rows for the test agent have non-null group_id
"""

import os
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/allura")
LOGS_DIR = "/logs"
REWARD_FILE = f"{LOGS_DIR}/reward.txt"


def write_reward(score: float, reason: str):
    os.makedirs(LOGS_DIR, exist_ok=True)
    with open(REWARD_FILE, "w") as f:
        f.write(str(round(score, 4)))
    print(f"[verifier] reward={score:.4f} reason={reason}")


def main():
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception as e:
        write_reward(0.0, f"postgres-connect-failed:{e}")
        return

    score = 0.0
    reasons = []

    try:
        # Check 1: Agent wrote a row with group_id = 'allura-test' (0.30)
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, group_id, event_type
                FROM agent_events
                WHERE group_id = 'allura-test'
                  AND event_type = 'benchmark_event'
                  AND agent_id = 'isolation-test-agent'
                LIMIT 1
            """)
            row = cur.fetchone()
            if row:
                score += 0.30
                reasons.append("row_written:ok")
            else:
                reasons.append("row_written:missing")

        # Check 2: Cross-tenant query returns 0 rows (0.30)
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM agent_events
                WHERE group_id = 'allura-other'
                  AND event_type = 'benchmark_event'
            """)
            leak_count = cur.fetchone()[0]
            if leak_count == 0:
                score += 0.30
                reasons.append("isolation:ok")
            else:
                reasons.append(f"isolation:leaked({leak_count}rows)")

        # Check 3: Schema rejects insert without group_id (0.25)
        # We attempt the violating insert ourselves to verify the constraint exists
        schema_ok = False
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO agent_events (event_type, agent_id, status)
                    VALUES ('benchmark_event', 'no-tenant-agent', 'completed')
                """)
            conn.rollback()
            # If we get here, the insert succeeded — schema is missing the constraint
            reasons.append("schema_constraint:missing")
        except psycopg2.IntegrityError:
            conn.rollback()
            schema_ok = True
            score += 0.25
            reasons.append("schema_constraint:ok")
        except psycopg2.NotNullViolation:
            conn.rollback()
            schema_ok = True
            score += 0.25
            reasons.append("schema_constraint:ok(notnull)")
        except Exception as e:
            conn.rollback()
            # Any DB error on this insert is acceptable — constraint exists
            if "group_id" in str(e).lower() or "null" in str(e).lower() or "violat" in str(e).lower():
                schema_ok = True
                score += 0.25
                reasons.append("schema_constraint:ok(err)")
            else:
                reasons.append(f"schema_constraint:unexpected_error({e})")

        # Check 4: All rows for the test agent have non-null group_id (0.15)
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) as total,
                       COUNT(group_id) as with_group_id
                FROM agent_events
                WHERE event_type = 'benchmark_event'
                  AND agent_id = 'isolation-test-agent'
            """)
            total, with_gid = cur.fetchone()
            if total > 0 and total == with_gid:
                score += 0.15
                reasons.append("no_null_group_ids:ok")
            elif total == 0:
                reasons.append("no_null_group_ids:no_rows")
            else:
                reasons.append(f"no_null_group_ids:missing({total - with_gid}/{total})")

    except Exception as e:
        reasons.append(f"query-error:{e}")
    finally:
        conn.close()

    write_reward(min(1.0, score), " | ".join(reasons))


if __name__ == "__main__":
    main()
