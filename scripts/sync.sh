#!/usr/bin/env bash
# ============================================================================
# Allura Harness Sync Script
# ============================================================================
# Keeps .claude/ and .opencode/ in structural parity.
# Idempotent — safe to run multiple times.
#
# Usage:
#   ./scripts/sync.sh          # Dry run — show diffs only
#   ./scripts/sync.sh --apply  # Apply sync — copy missing files
#   ./scripts/sync.sh --verify # Verify parity — exit 1 on drift
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_DIR="$REPO_ROOT/.claude"
OPENCODE_DIR="$REPO_ROOT/.opencode"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

DRY_RUN=true; VERIFY_ONLY=false; APPLY=false
for arg in "$@"; do
  case "$arg" in
    --apply|-a) APPLY=true; DRY_RUN=false ;;
    --verify|-v) VERIFY_ONLY=true; DRY_RUN=false ;;
    --help|-h) echo "Usage: $0 [--apply|--verify|--help]"; exit 0 ;;
  esac
done

COPIED=0; MISSING=0; MATCHED=0; TOTAL=0; DRIFT=0

declare -a SYNC_MAP=(
  "AI-GUIDELINES.md|AI-GUIDELINES.md"
  "agent/core/brooks-architect.md|agents/brooks.md"
  "agent/core/jobs-intent-gate.md|agents/jobs.md"
  "agent/subagents/core/fowler-refactor-gate.md|agents/fowler.md"
  "agent/subagents/core/pike-interface-review.md|agents/pike.md"
  "agent/subagents/core/ralph-loop.md|agents/ralph.md"
  "agent/subagents/core/scout-recon.md|agents/scout.md"
  "agent/subagents/code/bellard-diagnostics-perf.md|agents/bellard.md"
  "agent/subagents/code/dijkstra-review.md|agents/dijkstra.md"
  "agent/subagents/code/knuth-analyze.md|agents/knuth.md"
  "agent/subagents/code/woz-builder.md|agents/woz.md"
  "templates/BLUEPRINT.template.md|templates/BLUEPRINT.template.md"
  "templates/DATA-DICTIONARY.template.md|templates/DATA-DICTIONARY.template.md"
  "templates/DESIGN.template.md|templates/DESIGN.template.md"
  "templates/REQUIREMENTS-MATRIX.template.md|templates/REQUIREMENTS-MATRIX.template.md"
  "templates/RISKS-AND-DECISIONS.template.md|templates/RISKS-AND-DECISIONS.template.md"
  "templates/SOLUTION-ARCHITECTURE.template.md|templates/SOLUTION-ARCHITECTURE.template.md"
  "contracts/harness-v1.md|contracts/harness-v1.md"
  "contracts/ralph-integration.md|contracts/ralph-integration.md"
  "config/agent-metadata.json|config/agent-metadata.json"
  "config/agent-skills.json|agent-skills.json"
  "BROOKS-TRACKING.md|BROOKS-TRACKING.md"
  "HANDOFF.md|HANDOFF.md"
  "HARNESS-GUIDE.md|HARNESS-GUIDE.md"
  "MODEL_REGISTRY.md|MODEL_REGISTRY.md"
  "_bootstrap.md|_bootstrap.md"
)

log_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Allura Harness Sync${NC} — $(date -Iseconds)"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  if $DRY_RUN; then echo -e "${YELLOW}  MODE: DRY RUN${NC}"
  elif $APPLY; then echo -e "${GREEN}  MODE: APPLY${NC}"
  elif $VERIFY_ONLY; then echo -e "${CYAN}  MODE: VERIFY${NC}"; fi
  echo ""
}

sync_mapped_file() {
  local oc_rel="$1" cl_rel="$2"
  local oc_path="$OPENCODE_DIR/$oc_rel" cl_path="$CLAUDE_DIR/$cl_rel"
  TOTAL=$((TOTAL + 1))
  local oc_exists=false cl_exists=false
  [[ -f "$oc_path" ]] && oc_exists=true
  [[ -f "$cl_path" ]] && cl_exists=true
  if ! $oc_exists && ! $cl_exists; then echo -e "${RED}  ✗ BOTH MISSING: $oc_rel / $cl_rel${NC}"; MISSING=$((MISSING+1)); return 1; fi
  if $oc_exists && ! $cl_exists; then
    echo -e "${YELLOW}  ⚠ .claude/ missing: $cl_rel${NC}"; MISSING=$((MISSING+1))
    if $APPLY; then mkdir -p "$(dirname "$cl_path")"; cp "$oc_path" "$cl_path"; echo -e "${GREEN}  ✓ → .claude/$cl_rel${NC}"; COPIED=$((COPIED+1)); fi; return 0; fi
  if ! $oc_exists && $cl_exists; then
    echo -e "${YELLOW}  ⚠ .opencode/ missing: $oc_rel${NC}"; MISSING=$((MISSING+1))
    if $APPLY; then mkdir -p "$(dirname "$oc_path")"; cp "$cl_path" "$oc_path"; echo -e "${GREEN}  ✓ → .opencode/$oc_rel${NC}"; COPIED=$((COPIED+1)); fi; return 0; fi
  if ! diff -q "$oc_path" "$cl_path" &>/dev/null; then
    echo -e "${YELLOW}  ⚠ DRIFT: $oc_rel ↔ $cl_rel${NC}"; DRIFT=$((DRIFT+1))
    if $APPLY; then
      local oc_size cl_size
      oc_size=$(stat -c%s "$oc_path" 2>/dev/null || stat -f%z "$oc_path")
      cl_size=$(stat -c%s "$cl_path" 2>/dev/null || stat -f%z "$cl_path")
      if [[ "$oc_size" -ge "$cl_size" ]]; then cp "$oc_path" "$cl_path"; echo -e "${GREEN}  ✓ SYNCED (OC→CL): $cl_rel${NC}"
      else cp "$cl_path" "$oc_path"; echo -e "${GREEN}  ✓ SYNCED (CL→OC): $oc_rel${NC}"; fi
      COPIED=$((COPIED+1)); fi; return 0; fi
  echo -e "${GREEN}  ✓ $oc_rel ↔ $cl_rel${NC}"; MATCHED=$((MATCHED+1)); return 0
}

sync_dir() {
  local src_base="$1" dest_base="$2" src_subdir="$3" dest_subdir="$4" ext="$5"
  # If only 4 args, src and dest subdir are the same
  [[ -z "$ext" ]] && { ext="$4"; dest_subdir="$src_subdir"; }
  local src_dir="$src_base/$src_subdir" dest_dir="$dest_base/$dest_subdir"
  echo -e "\n${CYAN}── $src_subdir ↔ $dest_subdir Sync ──${NC}"
  local -A all_items
  for f in "$src_dir"/*."$ext"; do [[ -f "$f" ]] && all_items["$(basename "$f")"]=1; done
  for f in "$dest_dir"/*."$ext"; do [[ -f "$f" ]] && all_items["$(basename "$f")"]=1; done
  for name in $(echo "${!all_items[@]}" | tr ' ' '\n' | sort); do
    local src_f="$src_dir/$name" dest_f="$dest_dir/$name"
    TOTAL=$((TOTAL + 1))
    local s_exists=false d_exists=false
    [[ -f "$src_f" ]] && s_exists=true
    [[ -f "$dest_f" ]] && d_exists=true
    if $s_exists && ! $d_exists; then
      echo -e "${YELLOW}  ⚠ Missing: $dest_subdir/$name${NC}"; MISSING=$((MISSING+1))
      if $APPLY; then mkdir -p "$dest_dir"; cp "$src_f" "$dest_f"; echo -e "${GREEN}  ✓ → $dest_dir/$name${NC}"; COPIED=$((COPIED+1)); fi
    elif ! $s_exists && $d_exists; then
      echo -e "${YELLOW}  ⚠ Missing: $src_subdir/$name${NC}"; MISSING=$((MISSING+1))
      if $APPLY; then mkdir -p "$src_dir"; cp "$dest_f" "$src_f"; echo -e "${GREEN}  ✓ → $src_dir/$name${NC}"; COPIED=$((COPIED+1)); fi
    elif $s_exists && $d_exists; then
      if ! diff -q "$src_f" "$dest_f" &>/dev/null; then
        echo -e "${YELLOW}  ⚠ DRIFT: $src_subdir/$name${NC}"; DRIFT=$((DRIFT+1))
        if $APPLY; then
          local ss ds
          ss=$(stat -c%s "$src_f" 2>/dev/null || stat -f%z "$src_f")
          ds=$(stat -c%s "$dest_f" 2>/dev/null || stat -f%z "$dest_f")
          if [[ "$ss" -ge "$ds" ]]; then cp "$src_f" "$dest_f"; echo -e "${GREEN}  ✓ SYNCED (OC→CL): $name${NC}"
          else cp "$dest_f" "$src_f"; echo -e "${GREEN}  ✓ SYNCED (CL→OC): $name${NC}"; fi
          COPIED=$((COPIED+1)); fi
      else echo -e "${GREEN}  ✓ $src_subdir/$name${NC}"; MATCHED=$((MATCHED+1)); fi
    fi
  done
}

log_header
echo -e "${CYAN}── File Sync Map (Layers 1-11) ──${NC}"
for entry in "${SYNC_MAP[@]}"; do
  IFS='|' read -r oc_rel cl_rel <<< "$entry"
  sync_mapped_file "$oc_rel" "$cl_rel"
done

# Sync skill directories (SKILL.md only)
echo -e "\n${CYAN}── Skills Sync ──${NC}"
declare -A all_skills
for d in "$OPENCODE_DIR"/skills/*/; do [[ -d "$d" ]] && all_skills["$(basename "$d")"]=1; done
for d in "$CLAUDE_DIR"/skills/*/; do [[ -d "$d" ]] && all_skills["$(basename "$d")"]=1; done
for sn in $(echo "${!all_skills[@]}" | tr ' ' '\n' | sort); do
  TOTAL=$((TOTAL + 1))
  oc_s="$OPENCODE_DIR/skills/$sn/SKILL.md" cl_s="$CLAUDE_DIR/skills/$sn/SKILL.md"
  oc_x=false cl_x=false
  [[ -f "$oc_s" ]] && oc_x=true; [[ -f "$cl_s" ]] && cl_x=true
  if $oc_x && ! $cl_x; then
    echo -e "${YELLOW}  ⚠ .claude/ missing skill: $sn${NC}"; MISSING=$((MISSING+1))
    if $APPLY; then mkdir -p "$CLAUDE_DIR/skills/$sn"; cp "$oc_s" "$cl_s"
      [[ ! -f "$CLAUDE_DIR/skills/$sn/metadata.json" ]] && echo "{\"name\":\"$sn\",\"description\":\"Ported from OpenCode\",\"version\":\"1.0.0\",\"triggers\":[\"$sn\"]}" > "$CLAUDE_DIR/skills/$sn/metadata.json"
      echo -e "${GREEN}  ✓ → .claude/skills/$sn${NC}"; COPIED=$((COPIED+1)); fi
  elif ! $oc_x && $cl_x; then
    echo -e "${YELLOW}  ⚠ .opencode/ missing skill: $sn${NC}"; MISSING=$((MISSING+1))
    if $APPLY; then mkdir -p "$OPENCODE_DIR/skills/$sn"; cp "$cl_s" "$oc_s"; echo -e "${GREEN}  ✓ → .opencode/skills/$sn${NC}"; COPIED=$((COPIED+1)); fi
  elif $oc_x && $cl_x; then
    if ! diff -q "$oc_s" "$cl_s" &>/dev/null; then
      echo -e "${YELLOW}  ⚠ DRIFT: skills/$sn${NC}"; DRIFT=$((DRIFT+1))
      if $APPLY; then
        declare ssize csize
        ssize=$(stat -c%s "$oc_s" 2>/dev/null || stat -f%z "$oc_s")
        csize=$(stat -c%s "$cl_s" 2>/dev/null || stat -f%z "$cl_s")
        if [[ "$ssize" -ge "$csize" ]]; then cp "$oc_s" "$cl_s"; echo -e "${GREEN}  ✓ SYNCED (OC→CL): $sn${NC}"
        else cp "$cl_s" "$oc_s"; echo -e "${GREEN}  ✓ SYNCED (CL→OC): $sn${NC}"; fi; COPIED=$((COPIED+1)); fi
    else echo -e "${GREEN}  ✓ skill: $sn${NC}"; MATCHED=$((MATCHED+1)); fi; fi
done

sync_dir "$OPENCODE_DIR" "$CLAUDE_DIR" "command" "commands" "md"
sync_dir "$CLAUDE_DIR" "$OPENCODE_DIR" "commands" "command" "md"
sync_dir "$CLAUDE_DIR" "$OPENCODE_DIR" "rules" "rules" "md"

# Typo check
# Typo check (endssssion.md should not exist in either harness)
echo -e "\n${CYAN}── Typo Check ──${NC}"
TOTAL=$((TOTAL + 1))
if compgen -G "$OPENCODE_DIR/command/endsss*" &>/dev/null || compgen -G "$CLAUDE_DIR/commands/endsss*" &>/dev/null; then
  echo -e "${RED}  ✗ TYPO: endssssion.md found${NC}"; MISSING=$((MISSING+1))
  if $APPLY; then
    for f in "$OPENCODE_DIR"/command/endsss*.md; do [[ -f "$f" ]] && mv "$f" "$OPENCODE_DIR/command/end-session.md" && echo -e "${GREEN}  ✓ FIXED: renamed OC to end-session.md${NC}"; done
    for f in "$CLAUDE_DIR"/commands/endsss*.md; do [[ -f "$f" ]] && mv "$f" "$CLAUDE_DIR/commands/end-session.md" && echo -e "${GREEN}  ✓ FIXED: renamed CL to end-session.md${NC}"; done
    COPIED=$((COPIED+1))
  fi
else
  echo -e "${GREEN}  ✓ No typos${NC}"; MATCHED=$((MATCHED+1))
fi

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SYNC SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Total checks:       $TOTAL"
echo -e "  ${GREEN}Matched:            $MATCHED${NC}"
echo -e "  ${YELLOW}Missing:            $MISSING${NC}"
echo -e "  ${YELLOW}Content drift:      $DRIFT${NC}"
echo -e "  ${GREEN}Applied this run:   $COPIED${NC}"
echo ""
PROBLEMS=$((MISSING + DRIFT))
if [[ $PROBLEMS -eq 0 ]]; then echo -e "${GREEN}✓ HARNESS PARITY — Zero drift, zero missing.${NC}"
elif $DRY_RUN; then echo -e "${YELLOW}⚠ $PROBLEMS issues — Run with --apply to sync${NC}"
elif $APPLY; then echo -e "${GREEN}✓ $COPIED operations completed${NC}"; echo -e "${YELLOW}  Run --verify to confirm${NC}"; fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
$VERIFY_ONLY && [[ $PROBLEMS -gt 0 ]] && exit 1
exit 0