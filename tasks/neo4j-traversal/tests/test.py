"""
Verifier: neo4j-traversal
Directly queries Neo4j to verify the agent created the correct
node/relationship structure.

Reward breakdown:
  0.25 — Agent and Decision v1 nodes exist with correct group_id
  0.25 — CONTRIBUTED relationship exists (agent → decision-v1)
  0.25 — SUPERSEDES chain exists (v2 → v1)
  0.15 — v2 is active, v1 is deprecated
  0.10 — both decisions have group_id = allura-test (tenant isolation)
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
            # Check 1: Agent + Decision v1 exist with group_id (0.25)
            result = session.run("""
                MATCH (a:Agent {name: 'benchmark-agent', group_id: 'allura-test'})
                MATCH (d1:Decision {decision_id: 'bench-decision-v1', group_id: 'allura-test'})
                RETURN a.name as agent, d1.decision_id as d1
            """)
            row = result.single()
            if row:
                score += 0.25
                reasons.append("nodes:ok")
            else:
                reasons.append("nodes:missing")

            # Check 2: CONTRIBUTED relationship (0.25)
            result = session.run("""
                MATCH (a:Agent {name: 'benchmark-agent', group_id: 'allura-test'})
                      -[:CONTRIBUTED]->(d:Decision {decision_id: 'bench-decision-v1'})
                RETURN count(*) as cnt
            """)
            cnt = result.single()["cnt"] if result.single() else 0
            # Re-run since single() consumes
            result = session.run("""
                MATCH (a:Agent {name: 'benchmark-agent', group_id: 'allura-test'})
                      -[:CONTRIBUTED]->(d:Decision {decision_id: 'bench-decision-v1'})
                RETURN count(*) as cnt
            """)
            cnt = result.single()["cnt"]
            if cnt > 0:
                score += 0.25
                reasons.append("contributed:ok")
            else:
                reasons.append("contributed:missing")

            # Check 3: SUPERSEDES chain v2 → v1 (0.25)
            result = session.run("""
                MATCH (d2:Decision {decision_id: 'bench-decision-v2'})
                      -[:SUPERSEDES]->(d1:Decision {decision_id: 'bench-decision-v1'})
                RETURN d2.decision_id as v2, d1.decision_id as v1
            """)
            chain = result.single()
            if chain:
                score += 0.25
                reasons.append("supersedes:ok")
            else:
                reasons.append("supersedes:missing")

            # Check 4: v2 active, v1 deprecated (0.15)
            result = session.run("""
                MATCH (d2:Decision {decision_id: 'bench-decision-v2'})
                MATCH (d1:Decision {decision_id: 'bench-decision-v1'})
                RETURN d2.status as v2_status, d1.status as v1_status
            """)
            statuses = result.single()
            if statuses and statuses["v2_status"] == "active" and statuses["v1_status"] == "deprecated":
                score += 0.15
                reasons.append("versioning:ok")
            else:
                reasons.append(f"versioning:wrong({statuses})")

            # Check 5: group_id on both decisions (0.10)
            result = session.run("""
                MATCH (d:Decision)
                WHERE d.decision_id IN ['bench-decision-v1', 'bench-decision-v2']
                  AND d.group_id IS NOT NULL
                  AND d.group_id = 'allura-test'
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
