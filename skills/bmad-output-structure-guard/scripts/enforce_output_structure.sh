#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
  echo "Usage: $0 <bmad-output-path>"
  exit 1
fi
[[ -d "$ROOT" ]] || { echo "Missing directory: $ROOT"; exit 1; }

mkdir -p "$ROOT/planning-artifacts" "$ROOT/implementation-artifacts" "$ROOT/test-artifacts" "$ROOT/ops-artifacts"

classify() {
  local f="$(basename "$1")"
  local u="${f^^}"
  if [[ "$u" == "INDEX.MD" ]]; then echo "root"; return; fi
  if [[ "$u" =~ (PRD|PLAN|BACKLOG|ARCHITECTURE|SPRINT|RISK|README|RUNBOOK|WORKFLOW|POLICY) ]]; then echo "planning-artifacts"; return; fi
  if [[ "$u" =~ (SCHEMA|MIGRATION|IMPLEMENT|MEMORY-DATABASE-LOAD|CODE) ]]; then echo "implementation-artifacts"; return; fi
  if [[ "$u" =~ (TEST|EVIDENCE|VALIDATION|INCIDENT|QA) ]]; then echo "test-artifacts"; return; fi
  if [[ "$u" =~ (DEPLOY|DOCKER|ENV|OPS) ]]; then echo "ops-artifacts"; return; fi
  echo "planning-artifacts"
}

shopt -s nullglob
for f in "$ROOT"/*.md; do
  b="$(basename "$f")"
  [[ "$b" == "INDEX.md" ]] && continue
  target_dir="$(classify "$f")"
  if [[ "$target_dir" != "root" ]]; then
    mv -f "$f" "$ROOT/$target_dir/$b"
  fi
done

python3 - <<PY
from pathlib import Path
root=Path('$ROOT')
lines=['# BMAD Output Index','']
for d in ['planning-artifacts','implementation-artifacts','test-artifacts','ops-artifacts']:
    p=root/d
    lines.append(f'## {d}')
    if p.exists():
        for f in sorted(p.glob('*')):
            lines.append(f'- {f.name}')
    lines.append('')
lines.append('## root-files')
for f in sorted(root.glob('*')):
    if f.is_file():
        lines.append(f'- {f.name}')
(root/'INDEX.md').write_text('\n'.join(lines))
print('INDEX updated:', root/'INDEX.md')
PY

echo "STRUCTURE_ENFORCED: $ROOT"
