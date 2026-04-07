"""
Verifier: curator-pipeline
Directly queries Neo4j to verify the agent exercised the full curator flow correctly.

Reward breakdown:
  0.25 — Insight v1 exists with status pending_approval or active (was proposed)
  0.25 — Insight v1 has approved_by set (HITL approval recorded)
  0.25 — SUPERSEDES chain exists: v2 -> v1
  0.15 — v2 is active, v1 is deprecated
  0.10 — both insights have group_id = allura-test (tenant isolation)
"""

import os
from neo4j import GraphDatabase

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "")
LOGS_DIR = "/logs"
REWARD_FILE = f"{LOGS_DIR}/reward.txt"


def write_reward(score: float, reason: str):
    os.makedirs(LOGS_DIR, exist_ok=True)
    with open(REWARD_FILE, "w") as f:
        f.write(str(round(score, 4)))
    print(f"[verifier] reward={score:.4f} reason={reason}")


def main():
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    except Exception as e:
        write_reward(0.0, f"neo4j-connect-failed:{e}")
        return

    score = 0.0
    reasons = []

    with driver.session() as session:
        try:
            # Check 1: Insight v1 was proposed (exists in Neo4j) (0.25)
            result = session.run("""
                MATCH (i1:Insight {insight_id: 'bench-insight-v1', group_id: 'allura-test'})
                RETURN i1.insight_id as id, i1.status as status
            """)
            row = result.single()
            if row:
                score += 0.25
                reasons.append("insight_proposed:ok")
            else:
                reasons.append("insight_proposed:missing")

            # Check 2: Insight v1 has approved_by set (HITL approval) (0.25)
            result = session.run("""
                MATCH (i1:Insight {insight_id: 'bench-insight-v1', group_id: 'allura-test'})
                WHERE i1.approved_by IS NOT NULL
                RETURN i1.approved_by as approved_by
            """)
            approval = result.single()
            if approval:
                score += 0.25
                reasons.append("approval_recorded:ok")
            else:
                reasons.append("approval_recorded:missing(approved_by is null)")

            # Check 3: SUPERSEDES chain v2 → v1 (0.25)
            result = session.run("""
                MATCH (i2:Insight {insight_id: 'bench-insight-v2'})
                      -[:SUPERSEDES]->(i1:Insight {insight_id: 'bench-insight-v1'})
                RETURN i2.insight_id as v2, i1.insight_id as v1
            """)
            chain = result.single()
            if chain:
                score += 0.25
                reasons.append("supersedes:ok")
            else:
                reasons.append("supersedes:missing")

            # Check 4: v2 active, v1 deprecated (0.15)
            result = session.run("""
                MATCH (i2:Insight {insight_id: 'bench-insight-v2'})
                MATCH (i1:Insight {insight_id: 'bench-insight-v1'})
                RETURN i2.status as v2_status, i1.status as v1_status
            """)
            statuses = result.single()
            if statuses and statuses["v2_status"] == "active" and statuses["v1_status"] == "deprecated":
                score += 0.15
                reasons.append("versioning:ok")
            else:
                reasons.append(f"versioning:wrong({statuses})")

            # Check 5: Both insights have group_id = allura-test (0.10)
            result = session.run("""
                MATCH (i:Insight)
                WHERE i.insight_id IN ['bench-insight-v1', 'bench-insight-v2']
                  AND i.group_id IS NOT NULL
                  AND i.group_id = 'allura-test'
                RETURN count(*) as cnt
            """)
            gid_cnt = result.single()["cnt"]
            if gid_cnt == 2:
                score += 0.10
                reasons.append("group_id:ok")
            else:
                reasons.append(f"group_id:missing({gid_cnt}/2)")

        except Exception as e:
            reasons.append(f"query-error:{e}")
        finally:
            driver.close()

    write_reward(min(1.0, score), " | ".join(reasons))


if __name__ == "__main__":
    main()
