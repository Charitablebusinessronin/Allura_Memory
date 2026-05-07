#!/usr/bin/env python3
"""
Patch manifest.json to add missing skills to overlay section.
Removes duplicates and sorts.
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / ".opencode" / "manifest.json"

SKILLS_DIR = REPO_ROOT / ".opencode" / "skills"

def main():
    data = json.loads(MANIFEST_PATH.read_text())
    
    # Build set of current overlay entries
    overlay_paths = set(data.get("overlay", []))
    core_paths = set(data.get("core", []))
    
    # Identify skills on disk that are NOT in manifest at all
    disk_skills = {d.name for d in SKILLS_DIR.iterdir() if d.is_dir() and (d / "SKILL.md").exists()}
    manifest_skills = {Path(p).name for p in (overlay_paths | core_paths) if Path(p).parent.name == "skills"}
    
    missing = disk_skills - manifest_skills
    
    for name in missing:
        overlay_paths.add(f".opencode/skills/{name}/")
    
    data["overlay"] = sorted(overlay_paths)
    
    MANIFEST_PATH.write_text(json.dumps(data, indent=2))
    print(f"Added {len(missing)} missing skills to manifest overlay:")
    for name in sorted(missing):
        print(f"  + {name}")

if __name__ == "__main__":
    main()
