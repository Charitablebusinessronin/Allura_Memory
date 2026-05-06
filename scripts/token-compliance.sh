#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Allura Memory — Token Compliance Validation (Story 2.7)
#
# Scans target directories for unauthorized raw hex colors and deprecated
# token usage patterns. Fails if violations are found.
#
# Exit codes:
#   0 = PASS  (no violations found)
#   1 = FAIL  (violations found)
# ──────────────────────────────────────────────────────────────────────────────
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$PROJECT_ROOT/src"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

pass_count=0
fail_count=0
warn_count=0
violations=()

log_pass() { echo -e "${GREEN}  ✓ $1${RESET}"; ((pass_count++)); }
log_fail() { echo -e "${RED}  ✗ $1${RESET}"; ((fail_count++)); violations+=("FAIL: $1"); }
log_warn() { echo -e "${YELLOW}  ⚠ $1${RESET}"; ((warn_count++)); }
log_section() { echo -e "\n${BOLD}── $1 ──${RESET}"; }

TARGET_DIRS=(
  "$SRC_DIR/app/(main)/dashboard"
  "$SRC_DIR/components/dashboard"
  "$SRC_DIR/components/memory-explorer"
)

EXCLUDE_PATTERNS=(
  "src/lib/brand/allura.ts"
  "src/lib/brand/durham.ts"
  "src/lib/tokens.ts"
  "src/lib/theme/brand.ts"
  "src/styles/brand-tokens.css"
  "src/styles/presets/allura.css"
  "src/styles/presets/durham.css"
  "src/styles/agency-dashboard.css"
  "src/app/globals.css"
  "src/lib/preferences/theme.ts"
)

is_excluded() {
  local filepath="$1"
  local rel_path="${filepath#$PROJECT_ROOT/}"
  
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$rel_path" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

scan_hex_colors() {
  log_section "1. Scanning for unauthorized hex color values"
  
  local violations_file=$(mktemp)
  local hex_count=0
  
  for dir in "${TARGET_DIRS[@]}"; do
    [[ -d "$dir" ]] || continue
    
    while IFS= read -r -d '' file; do
      if is_excluded "$file"; then
        continue
      fi
      
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        
        local filepath=$(echo "$line" | cut -d: -f1)
        local linenum=$(echo "$line" | cut -d: -f2)
        local content=$(echo "$line" | cut -d: -f3-)
        
        while IFS= read -r raw_hex; do
          [[ -z "$raw_hex" ]] && continue
          
          local clean_hex="${raw_hex#\#}"
          local hex_len=${#clean_hex}
          
          if [[ $hex_len -eq 3 || $hex_len -eq 6 || $hex_len -eq 8 ]]; then
            rel_path="${filepath#$PROJECT_ROOT/}"
            echo "${rel_path}:${linenum}:${raw_hex}" >> "$violations_file"
            ((hex_count++))
          fi
        done < <(echo "$content" | grep -oP '#[0-9a-fA-F]{3,8}' || true)
        
      done < <(grep -nP '#[0-9a-fA-F]{3,8}' "$file" 2>/dev/null || true)
    done < <(find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -print0 2>/dev/null || true)
  done
  
  if [[ $hex_count -gt 0 ]]; then
    log_fail "Found $hex_count hex color references in target directories"
    
    local unique_violations=$(sort -u "$violations_file" | wc -l)
    if [[ $unique_violations -gt 0 ]]; then
      log_warn "Unique violation count: $unique_violations"
      sort -u "$violations_file" | while IFS=: read -r fpath lnum hex; do
        echo -e "    ${YELLOW}${fpath}:${lnum} → ${hex}${RESET}"
      done
    fi
  else
    log_pass "No hex color references found in target directories"
  fi
  
  rm -f "$violations_file"
  return $hex_count
}

scan_deprecated_tokens() {
  log_section "2. Scanning for deprecated token usage"
  
  local violations_file=$(mktemp)
  local deprecated_count=0
  
  for dir in "${TARGET_DIRS[@]}"; do
    [[ -d "$dir" ]] || continue
    
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      
      local filepath=$(echo "$line" | cut -d: -f1)
      local linenum=$(echo "$line" | cut -d: -f2)
      
      if ! is_excluded "$filepath"; then
        local rel_path="${filepath#$PROJECT_ROOT/}"
        echo "${rel_path}:${linenum}:--allura-gold (deprecated)" >> "$violations_file"
        ((deprecated_count++))
      fi
    done < <(grep -rnP '\-\-allura-gold' "$dir" --include="*.tsx" --include="*.ts" --include="*.css" 2>/dev/null || true)
    
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      
      local filepath=$(echo "$line" | cut -d: -f1)
      local linenum=$(echo "$line" | cut -d: -f2)
      
      if ! is_excluded "$filepath"; then
        local rel_path="${filepath#$PROJECT_ROOT/}"
        echo "${rel_path}:${linenum}:#C89B3C (deprecated gold)" >> "$violations_file"
        ((deprecated_count++))
      fi
    done < <(grep -rnP '#C89B3C' "$dir" --include="*.tsx" --include="*.ts" --include="*.css" 2>/dev/null || true)
  done
  
  if [[ $deprecated_count -gt 0 ]]; then
    log_fail "Found $deprecated_count deprecated token references in target directories"
    
    local unique_violations=$(sort -u "$violations_file" | wc -l)
    if [[ $unique_violations -gt 0 ]]; then
      log_warn "Unique violation count: $unique_violations"
      sort -u "$violations_file" | while IFS=: read -r fpath lnum type; do
        echo -e "    ${RED}${fpath}:${lnum} → ${type}${RESET}"
      done
    fi
  else
    log_pass "No deprecated token references found in target directories"
  fi
  
  rm -f "$violations_file"
  return $deprecated_count
}

scan_hex_colors
HEX_EXIT=$?

scan_deprecated_tokens
DEPRECATED_EXIT=$?

log_section "3. Compliance Summary"

total=$((pass_count + fail_count + warn_count))
echo -e "  Checks run: ${BOLD}$total${RESET}"
echo -e "  ${GREEN}Passed: $pass_count${RESET}"
echo -e "  ${RED}Failed: $fail_count${RESET}"
echo -e "  ${YELLOW}Warnings: $warn_count${RESET}"

if [[ ${#violations[@]} -gt 0 ]]; then
  echo -e "\n${BOLD}${RED}Violation Details:${RESET}"
  for v in "${violations[@]}"; do
    echo -e "  ${RED}• $v${RESET}"
  done
fi

if [[ $fail_count -gt 0 ]]; then
  echo -e "\n${RED}${BOLD}TOKEN COMPLIANCE: FAILED${RESET}"
  exit 1
else
  echo -e "\n${GREEN}${BOLD}TOKEN COMPLIANCE: PASSED${RESET} (warnings: $warn_count)"
  exit 0
fi
