"""
Verifier: agent-routing
Checks that the orchestrator routes each task to the correct agent.

Each correct routing = 1/7 of the score.
Partial credit: wrong agent but correct reasoning category = 0.5/7.

Expected routing:
  1 → memory-scout      (discovery before building)
  2 → memory-builder    (Neo4j write operation)
  3 → memory-architect  (interface contract = architecture)
  4 → memory-guardian   (security audit = validation)
  5 → memory-chronicler (doc/yaml update)
  6 → memory-analyst    (metrics query)
  7 → task-manager      (task decomposition)
"""

import os
import json
import re

LOGS_DIR = "/logs"
REWARD_FILE = f"{LOGS_DIR}/reward.txt"
TRAJECTORY_FILE = f"{LOGS_DIR}/trajectory.json"

EXPECTED = {
    1: "memory-scout",
    2: "memory-builder",
    3: "memory-architect",
    4: "memory-guardian",
    5: "memory-chronicler",
    6: "memory-analyst",
    7: "task-manager",
}

# Partial credit: same functional category as expected
CATEGORY_MAP = {
    "memory-scout": "discovery",
    "memory-analyst": "read-only",
    "memory-guardian": "read-only",
    "memory-builder": "write",
    "memory-chronicler": "write",
    "memory-architect": "design",
    "task-manager": "planning",
    "context-retriever": "discovery",
}

def write_reward(score: float, reason: str):
    os.makedirs(LOGS_DIR, exist_ok=True)
    with open(REWARD_FILE, "w") as f:
        f.write(str(round(score, 4)))
    print(f"[verifier] reward={score:.4f} reason={reason}")

def extract_routing(trajectory_path: str) -> list[dict]:
    """Extract JSON routing output from agent trajectory."""
    if not os.path.exists(trajectory_path):
        return []
    try:
        with open(trajectory_path) as f:
            data = json.load(f)
        # Find last assistant message with JSON array
        for step in reversed(data.get("steps", [])):
            if step.get("source") == "assistant":
                msg = step.get("message", "")
                # Extract JSON array from message
                match = re.search(r'\[.*\]', msg, re.DOTALL)
                if match:
                    return json.loads(match.group())
    except Exception:
        pass
    return []

def main():
    routing = extract_routing(TRAJECTORY_FILE)

    if not routing:
        write_reward(0.0, "no-routing-output-found")
        return

    total = len(EXPECTED)
    score = 0.0
    reasons = []

    routing_map = {r.get("task_id"): r.get("agent", "").lower() for r in routing}

    for task_id, expected_agent in EXPECTED.items():
        actual = routing_map.get(task_id, "")
        if actual == expected_agent:
            score += 1.0 / total
            reasons.append(f"t{task_id}:correct")
        elif CATEGORY_MAP.get(actual) == CATEGORY_MAP.get(expected_agent):
            score += 0.5 / total
            reasons.append(f"t{task_id}:partial({actual})")
        else:
            reasons.append(f"t{task_id}:wrong({actual})")

    write_reward(min(1.0, score), " | ".join(reasons))

if __name__ == "__main__":
    main()
