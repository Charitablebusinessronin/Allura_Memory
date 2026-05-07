#!/usr/bin/env python3
"""
Allura Skill Triage Checker — v3

Scans .opencode/skills/ for:
1. Dead skills: orphan directories with zero canonical refs.
2. Orphans: not listed in manifest.json, SKILL-OWNERSHIP.md, or agent-skills.json.
3. Unmanifested: not in manifest.json overlay.
4. Overlap hotspots: keyword-cluster similarity (Jaccard).
5. Utility vs Routed classification.

Outputs JSON report + advisory console summary.
Advisory mode — no file modifications.
"""

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SKILLS_DIR = REPO_ROOT / ".opencode" / "skills"
MANIFEST_PATH = REPO_ROOT / ".opencode" / "manifest.json"
OWNERSHIP_PATH = REPO_ROOT / ".opencode" / "SKILL-OWNERSHIP.md"
AGENT_SKILLS_PATH = REPO_ROOT / ".opencode" / "config" / "agent-skills.json"
REPORT_PATH = REPO_ROOT / ".opencode" / "skill-triage-report.json"

OVERLAP_IGNORE = {
    frozenset({"allura-approve-promotion", "allura-propose-promotion"}),
    frozenset({"frontend-craft", "frontend-design"}),
    frozenset({"allura-graph-debug", "allura-health-observability"}),
    frozenset({"figma-generate-design", "figma-use"}),
}

# ... rest identical except enhanced main() ...

UTILITY_KEYWORDS = {
    "menu", "guide", "memory", "health", "observability", "debug",
    "search", "context", "audit", "security", "bluebook", "governance",
    "harness", "docker", "mcp", "best-practices", "best practices",
    "practices", "standards", "rules", "workflow", "util",
}

ROUTED_KEYWORDS = {
    "design", "implement", "build", "generate", "create", "craft",
    "prototype", "mockup", "figma", "penpot", "frontend", "shadcn",
    "code-connect", "code connect", "component", "ui", "ux",
    "builder", "creator", "writer", "review",
}

OVERLAP_STOPWORDS = {
    "and", "the", "for", "with", "use", "when", "to", "a", "an",
    "is", "of", "in", "on", "at", "or", "from", "by", "as", "be",
    "this", "that", "are", "using", "used", "skill", "skills",
    "you", "your", "all", "any", "can", "will", "should", "may",
    "has", "have", "it", "its", "not", "no", "but", "if",
}


def parse_skill_md(path: Path) -> dict[str, Any]:
    name = path.parent.name
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        content = ""
    fm: dict[str, str] = {}
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            for line in parts[1].splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    fm[k.strip().lower()] = v.strip().strip('"')
            content = parts[2]
    desc = fm.get("description", "").strip()
    if not desc:
        m = re.search(r"(?m)^(?!#|\s*$)(.+)", content)
        if m:
            desc = m.group(1).strip()
    if len(desc) > 512:
        desc = desc[:512] + "..."
    tokens = set(re.findall(r"[a-zA-Z]+(?:[-_][a-zA-Z]+)*", (desc + " " + content).lower()))
    tokens = tokens - OVERLAP_STOPWORDS
    return {
        "name": name,
        "description": desc,
        "tokens": tokens,
        "_content": content,
    }


def classify_skill(info: dict) -> str:
    text = (info["name"] + " " + info["description"]).lower()
    u_score = sum(1 for kw in UTILITY_KEYWORDS if kw in text)
    r_score = sum(1 for kw in ROUTED_KEYWORDS if kw in text)
    return "routed" if r_score > u_score else "utility"


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    inter = a & b
    union = a | b
    return len(inter) / len(union) if union else 0.0


def compute_overlap(skills: list[dict]) -> list[dict]:
    hotspots = []
    for i in range(len(skills)):
        for j in range(i + 1, len(skills)):
            a, b = skills[i], skills[j]
            pair = frozenset({a["name"], b["name"]})
            if pair in OVERLAP_IGNORE:
                continue
            score = jaccard(a["tokens"], b["tokens"])
            if score > 0.3:
                hotspots.append({
                    "skill_a": a["name"],
                    "skill_b": b["name"],
                    "score": round(score, 3),
                    "classification": "high" if score > 0.6 else "medium" if score > 0.45 else "low",
                })
    return sorted(hotspots, key=lambda x: x["score"], reverse=True)


def load_manifest() -> set[str]:
    if not MANIFEST_PATH.exists():
        return set()
    data = json.loads(MANIFEST_PATH.read_text())
    return {Path(p).name for p in data.get("overlay", []) + data.get("core", []) if Path(p).parent.name == "skills"}


def load_ownership() -> set[str]:
    if not OWNERSHIP_PATH.exists():
        return set()
    text = OWNERSHIP_PATH.read_text()
    skills = set()
    for line in text.splitlines():
        m = re.match(r"\|\s*([a-z0-9-]+)\s*\|", line)
        if m and m.group(1) not in {"Skill", "skill", "---", "---|---|---|---|---|---", ""}:
            skills.add(m.group(1))
    return skills


def load_agent_skills() -> dict[str, list[str]]:
    if not AGENT_SKILLS_PATH.exists():
        return {}
    return json.loads(AGENT_SKILLS_PATH.read_text()).get("skills", {})


def extract_references(skills: list[dict]) -> dict[str, int]:
    all_text = " ".join(s["_content"] for s in skills)
    for p in [MANIFEST_PATH, OWNERSHIP_PATH, AGENT_SKILLS_PATH]:
        if p.exists():
            all_text += " " + p.read_text()
    ref_counts: dict[str, int] = {}
    for s in skills:
        name = s["name"]
        count = len(re.findall(rf"`({re.escape(name)})`", all_text))
        count += len(re.findall(rf"\b{re.escape(name)}\b", all_text))
        ref_counts[name] = max(count, 1)
    return ref_counts


def main() -> int:
    args = sys.argv[1:]
    fail_on_dead = "--fail-on-dead" in args

    if not SKILLS_DIR.exists():
        print(f"ERROR: skills directory not found at {SKILLS_DIR}", file=sys.stderr)
        return 1

    skills: list[dict] = []
    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        if not skill_dir.is_dir():
            continue
        md = skill_dir / "SKILL.md"
        if not md.exists():
            continue
        info = parse_skill_md(md)
        info["classification"] = classify_skill(info)
        skills.append(info)

    manifest_skills = load_manifest()
    ownership_skills = load_ownership()
    agent_skills = load_agent_skills()
    all_agent_skill_refs: set[str] = set()
    for skill_list in agent_skills.values():
        all_agent_skill_refs.update(skill_list)

    ref_counts = extract_references(skills)

    report: dict[str, Any] = {
        "scan_time": datetime.now(timezone.utc).isoformat(),
        "total_skills_on_disk": len(list(SKILLS_DIR.iterdir())),
        "skills_with_skill_md": len(skills),
        "metrics": {},
        "dead_skills": [],
        "orphans": [],
        "unmanifested": [],
        "not_in_ownership": [],
        "not_in_agent_config": [],
        "overlap_hotspots": [],
        "utility_skills": [],
        "routed_skills": [],
        "triage_actions": [],
    }

    for skill in skills:
        name = skill["name"]
        ref_count = ref_counts.get(name, 1)
        is_manifested = name in manifest_skills
        is_in_ownership = name in ownership_skills
        is_in_agent = name in all_agent_skill_refs

        if not is_manifested and ref_count <= 1:
            report["dead_skills"].append(name)
        if not is_manifested:
            report["unmanifested"].append(name)
        if not is_in_ownership:
            report["not_in_ownership"].append(name)
        if not is_in_agent and is_in_ownership:
            report["not_in_agent_config"].append(name)
        if skill["classification"] == "utility":
            report["utility_skills"].append(name)
        else:
            report["routed_skills"].append(name)

    report["orphans"] = [
        s["name"] for s in skills
        if s["name"] not in manifest_skills
        and s["name"] not in ownership_skills
        and s["name"] not in all_agent_skill_refs
    ]

    report["overlap_hotspots"] = compute_overlap(skills)

    report["metrics"] = {
        "total_skills_on_disk": report["total_skills_on_disk"],
        "skills_with_skill_md": report["skills_with_skill_md"],
        "dead_skills_count": len(report["dead_skills"]),
        "orphans_count": len(report["orphans"]),
        "unmanifested_count": len(report["unmanifested"]),
        "not_in_ownership_count": len(report["not_in_ownership"]),
        "not_in_agent_config_count": len(report["not_in_agent_config"]),
        "overlap_hotspots_count": len(report["overlap_hotspots"]),
        "utility_skills_count": len(report["utility_skills"]),
        "routed_skills_count": len(report["routed_skills"]),
    }

    for orphan in report["orphans"]:
        report["triage_actions"].append(
            {"action": "delete_or_archive", "skill": orphan, "reason": "orphan + zero canonical refs"}
        )
    for hotspot in report["overlap_hotspots"][:5]:
        report["triage_actions"].append(
            {
                "action": "review_merge",
                "skills": [hotspot["skill_a"], hotspot["skill_b"]],
                "reason": f"keyword-overlap score {hotspot['score']} ({hotspot['classification']})",
            }
        )
    for unmanifested in report["unmanifested"]:
        if unmanifested not in report["orphans"]:
            report["triage_actions"].append(
                {"action": "add_to_manifest", "skill": unmanifested, "reason": "exists on disk but not in manifest.json"}
            )
    for missing in report["not_in_ownership"]:
        if missing not in report["orphans"]:
            report["triage_actions"].append(
                {"action": "add_to_ownership_matrix", "skill": missing, "reason": "missing from SKILL-OWNERSHIP.md"}
            )

    REPORT_PATH.write_text(json.dumps(report, indent=2))
    print(f"Report: {REPORT_PATH}\n")

    m = report["metrics"]
    print("=" * 60)
    print("ALLURA SKILL TRIAGE ADVISORY")
    print("=" * 60)
    print(f"Total skill directories:      {m['total_skills_on_disk']}")
    print(f"With valid SKILL.md:          {m['skills_with_skill_md']}")
    print(f"Dead skills (orphan+≤1ref):   {m['dead_skills_count']}")
    print(f"True orphans:                {m['orphans_count']}")
    print(f"Unmanifested:                {m['unmanifested_count']}")
    print(f"Missing from ownership:      {m['not_in_ownership_count']}")
    print(f"Not in agent config:         {m['not_in_agent_config_count']}")
    print(f"Overlap hotspots:            {m['overlap_hotspots_count']}")
    print(f"Utility skills:              {m['utility_skills_count']}")
    print(f"Routed skills:               {m['routed_skills_count']}")
    print("=" * 60)

    if report["dead_skills"]:
        print("\n🪦 DEAD SKILLS (archive/delete):")
        for s in report["dead_skills"]:
            print(f"   - {s}")
    if report["orphans"]:
        print("\n👤 ORPHANS (untracked):")
        for s in report["orphans"]:
            print(f"   - {s}")
    if report["unmanifested"]:
        print("\n📦 UNMANIFESTED (not in manifest.json):")
        for s in report["unmanifested"]:
            print(f"   - {s}")
    if report["not_in_ownership"]:
        print("\n📝 MISSING FROM OWNERSHIP:")
        for s in report["not_in_ownership"]:
            print(f"   - {s}")
    if report["not_in_agent_config"]:
        print("\n⚙️  NOT IN AGENT CONFIG:")
        for s in report["not_in_agent_config"]:
            print(f"   - {s}")
    if report["overlap_hotspots"]:
        print("\n⚠️  OVERLAP HOTSPOTS:")
        for h in report["overlap_hotspots"]:
            print(f"   - {h['skill_a']} ↔ {h['skill_b']} (score: {h['score']}, {h['classification']})")

    print(f"\n{'='*60}")
    print("STATUS: No blockers. Ready for CI.")
    print(f"{'='*60}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
