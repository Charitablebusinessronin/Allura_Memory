#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Allura Memory — Brand Compliance Audit (FR-9.1)
#
# Scans all .tsx/.ts/.css files in src/ for hardcoded hex colors not present
# in the design token files, verifies brand font weights, and runs WCAG
# contrast checks on token color pairings.
#
# Exit codes:
#   0 = PASS  (all checks green, warnings allowed)
#   1 = FAIL  (violations found)
# ──────────────────────────────────────────────────────────────────────────────
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$PROJECT_ROOT/src"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

pass_count=0; fail_count=0; warn_count=0
violations=()

log_pass() { echo -e "${GREEN}  ✓ $1${RESET}"; ((pass_count++)); }
log_fail() { echo -e "${RED}  ✗ $1${RESET}"; ((fail_count++)); violations+=("FAIL: $1"); }
log_warn() { echo -e "${YELLOW}  ⚠ $1${RESET}"; ((warn_count++)); violations+=("WARN: $1"); }
log_section() { echo -e "\n${BOLD}${CYAN}── $1 ──${RESET}"; }

# ── Helper: Normalize hex to uppercase #RRGGBB ───────────────────────────────
normalize_hex() {
  local raw="${1#\#}"
  local upper=$(echo "$raw" | tr '[:lower:]' '[:upper:]')
  local len=${#upper}
  if [[ $len -eq 3 ]]; then
    echo "#${upper:0:1}${upper:0:1}${upper:1:1}${upper:1:1}${upper:2:1}${upper:2:1}"
  elif [[ $len -eq 4 ]]; then
    echo "#${upper:0:1}${upper:0:1}${upper:1:1}${upper:1:1}${upper:2:1}${upper:2:1}"
  elif [[ $len -eq 6 ]]; then
    echo "#$upper"
  elif [[ $len -eq 8 ]]; then
    echo "#${upper:0:6}"
  fi
}

# ── 1. Build allowed hex set from token definition files ────────────────────
log_section "1. Loading allowed hex values from design token files"

TOKEN_FILES=(
  "$SRC_DIR/lib/brand/allura.ts"
  "$SRC_DIR/lib/brand/durham.ts"
  "$SRC_DIR/lib/tokens.ts"
  "$SRC_DIR/lib/theme/brand.ts"
  "$SRC_DIR/styles/brand-tokens.css"
  "$SRC_DIR/styles/presets/allura.css"
  "$SRC_DIR/styles/presets/durham.css"
  "$SRC_DIR/styles/agency-dashboard.css"
  "$SRC_DIR/app/globals.css"
  "$SRC_DIR/lib/preferences/theme.ts"
)

ALLOWED_FILE=$(mktemp)
for f in "${TOKEN_FILES[@]}"; do
  [[ -f "$f" ]] || continue
  grep -oP '#[0-9a-fA-F]{3,8}' "$f" 2>/dev/null || true
done | while IFS= read -r hex; do
  normalized=$(normalize_hex "$hex")
  [[ -n "$normalized" ]] && echo "$normalized"
done | sort -u > "$ALLOWED_FILE"

allowed_count=$(wc -l < "$ALLOWED_FILE")
log_pass "Loaded $allowed_count unique allowed hex values from ${#TOKEN_FILES[@]} token definition files"

# ── 2. Scan source files for hardcoded hex violations ────────────────────────
log_section "2. Scanning source files for hardcoded hex colors"

# Get all hex matches from source files, excluding token definition files
ALL_HEX_FILE=$(mktemp)
grep -rnP '#[0-9a-fA-F]{3,8}' "$SRC_DIR" \
  --include="*.tsx" --include="*.ts" --include="*.css" \
  2>/dev/null > "$ALL_HEX_FILE" || true  # don't fail on no matches

# Filter out token definition file paths
FILTERED_FILE=$(mktemp)
if [[ -s "$ALL_HEX_FILE" ]]; then
  cat "$ALL_HEX_FILE" | \
    grep -vP "src/lib/brand/(allura|durham)\.ts:" | \
    grep -vP "src/lib/tokens\.ts:" | \
    grep -vP "src/lib/theme/brand\.ts:" | \
    grep -vP "src/styles/brand-tokens\.css:" | \
    grep -vP "src/styles/presets/(allura|durham)\.css:" | \
    grep -vP "src/styles/agency-dashboard\.css:" | \
    grep -vP "src/app/globals\.css:" | \
    grep -vP "src/lib/preferences/theme\.ts:" | \
    grep -vP "src/lib/fonts/registry\.ts:" \
    > "$FILTERED_FILE" || true
fi

# Process filtered results: check each hex against allowed set
VIOLATIONS_FILE=$(mktemp)
if [[ -s "$FILTERED_FILE" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    filepath=$(echo "$line" | cut -d: -f1)
    linenum=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)

    # Extract each hex color on this line
    for raw_hex in $(echo "$content" | grep -oP '#[0-9a-fA-F]{3,8}' || true); do
      clean="${raw_hex#\#}"
      clen=${#clean}
      # Only valid CSS hex color lengths: 3, 6, 8
      # NOTE: 4-char hex (#RGBA) is valid CSS but almost never used intentionally
      # in this codebase — it's usually a false positive like Trace #1042.
      # If you need 4-char hex support, change the check below.
      if [[ $clen -ne 3 && $clen -ne 6 && $clen -ne 8 ]]; then
        continue
      fi

      normalized=$(normalize_hex "$raw_hex")
      [[ -z "$normalized" ]] && continue

      # Check if in allowed set
      if ! grep -qx "$normalized" "$ALLOWED_FILE"; then
        rel_path="${filepath#$PROJECT_ROOT/}"
        echo "${rel_path}:${linenum} → ${raw_hex} (normalized: ${normalized})" >> "$VIOLATIONS_FILE"
      fi
    done
  done < "$FILTERED_FILE"
fi

if [[ -s "$VIOLATIONS_FILE" ]]; then
  sort -u -o "$VIOLATIONS_FILE" "$VIOLATIONS_FILE"
  hex_violation_count=$(wc -l < "$VIOLATIONS_FILE")
  log_fail "Found $hex_violation_count hardcoded hex color violation(s):"
  while IFS= read -r vline; do
    echo -e "    ${RED}$vline${RESET}"
  done < "$VIOLATIONS_FILE"
else
  log_pass "No hardcoded hex color violations found in source files"
fi

# ── 3. Verify brand font weights ──────────────────────────────────────────────
log_section "3. Verifying brand font configuration"

FONT_REGISTRY="$SRC_DIR/lib/fonts/registry.ts"
REQUIRED_WEIGHTS=(400 500 600 700 900)

if [[ -f "$FONT_REGISTRY" ]]; then
  for weight in "${REQUIRED_WEIGHTS[@]}"; do
    if grep -qP "(weight|wght).*$weight" "$FONT_REGISTRY" || grep -qP "@fontsource.*/$weight" "$FONT_REGISTRY"; then
      log_pass "Font weight $weight is loaded"
    else
      log_warn "Font weight $weight is NOT loaded in font registry (required by Kotler brand spec)"
    fi
  done
else
  log_fail "Font registry file not found: $FONT_REGISTRY"
fi

# Check for Montserrat references (Kotler brand direction)
if grep -rq "Montserrat" "$SRC_DIR" --include="*.ts" --include="*.tsx" --include="*.css" 2>/dev/null; then
  log_pass "Montserrat font referenced in source"
else
  log_warn "Montserrat font NOT referenced — Kotler brand spec requires Montserrat for weight 900 (current: IBM Plex Sans)"
fi

# ── 4. WCAG contrast checks ───────────────────────────────────────────────────
log_section "4. WCAG contrast ratio checks on token color pairings"

relative_luminance() {
  local hex="${1#\#}"
  local r=$((16#${hex:0:2})) g=$((16#${hex:2:2})) b=$((16#${hex:4:2}))
  awk "BEGIN {
    rs=$r/255; gs=$g/255; bs=$b/255
    if (rs<=0.04045) rl=rs/12.92; else rl=((rs+0.055)/1.055)^2.4
    if (gs<=0.04045) gl=gs/12.92; else gl=((gs+0.055)/1.055)^2.4
    if (bs<=0.04045) bl=bs/12.92; else bl=((bs+0.055)/1.055)^2.4
    printf \"%.6f\", 0.2126*rl + 0.7152*gl + 0.0722*bl
  }"
}

contrast_ratio() {
  local l1=$(relative_luminance "$1")
  local l2=$(relative_luminance "$2")
  awk "BEGIN {
    l1=$l1; l2=$l2
    if (l1<l2) { t=l1; l1=l2; l2=t }
    printf \"%.2f\", (l1+0.05)/(l2+0.05)
  }"
}

declare -A BRAND_COLORS
BRAND_COLORS[blue]="#1D4ED8";        BRAND_COLORS[blue-hover]="#1E40AF"
BRAND_COLORS[orange]="#FF5A2E";      BRAND_COLORS[orange-hover]="#E04D1F"
BRAND_COLORS[green]="#157A4A";       BRAND_COLORS[green-hover]="#166534"
BRAND_COLORS[gold]="#C89B3C";         BRAND_COLORS[gold-hover]="#A87D2B"
BRAND_COLORS[charcoal]="#0F1115";    BRAND_COLORS[cream]="#F6F4EF"
BRAND_COLORS[white]="#FFFFFF"
BRAND_COLORS[gray-100]="#F3F4F6";    BRAND_COLORS[gray-200]="#E5E7EB"
BRAND_COLORS[gray-300]="#D1D5DB";    BRAND_COLORS[gray-400]="#9CA3AF"
BRAND_COLORS[gray-500]="#6B7280";    BRAND_COLORS[gray-600]="#4B5563"
BRAND_COLORS[gray-700]="#374151";    BRAND_COLORS[gray-800]="#1F2937"
BRAND_COLORS[danger]="#DC2626"

# Color pairings: fg_name:bg_name:min_ratio (4.5 normal, 3.0 large text)
COLOR_PAIRS=(
  "charcoal:white:4.5"
  "white:blue:4.5"
  "white:charcoal:4.5"
  "gray-500:white:4.5"
  "gray-400:white:3.0"
  "white:orange:4.5"
  "white:green:4.5"
  "white:danger:4.5"
  "charcoal:cream:4.5"
  "gold:white:3.0"
  "blue:white:4.5"
  "gray-500:cream:4.5"
  "gray-400:cream:3.0"
  "white:gray-800:4.5"
  "white:gray-700:4.5"
  "white:green-hover:4.5"
  "white:blue-hover:4.5"
)

for pair_spec in "${COLOR_PAIRS[@]}"; do
  IFS=: read -r fg_name bg_name min_ratio <<< "$pair_spec"
  fg_hex="${BRAND_COLORS[$fg_name]}"
  bg_hex="${BRAND_COLORS[$bg_name]}"

  size_label="normal text"
  if awk "BEGIN {exit !($min_ratio < 4.5)}"; then
    size_label="large text"
  fi

  ratio=$(contrast_ratio "$fg_hex" "$bg_hex")

  if awk "BEGIN {exit !($ratio >= $min_ratio)}"; then
    log_pass "$fg_name on $bg_name: ${ratio}:1 (min ${min_ratio}:1 for $size_label)"
  else
    log_fail "$fg_name on $bg_name: ${ratio}:1 FAILS (min ${min_ratio}:1 for $size_label) — $fg_hex on $bg_hex"
  fi
done

# ── 5. Summary ────────────────────────────────────────────────────────────────
log_section "5. Audit Summary"

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

# ── 6. JSON Output (for CI artifact) ─────────────────────────────────────────
REPORT_FILE="$PROJECT_ROOT/brand-audit-results.json"
awk -v passed="$pass_count" -v failed="$fail_count" -v warned="$warn_count" \
    -v status="$([ $fail_count -gt 0 ] && echo 'FAILED' || echo 'PASSED')" \
    -v violations_json="$(printf '%s\n' "${violations[@]}" | jq -R . | jq -s .)" \
    'BEGIN {
      printf "{\n"
      printf "  \"status\": \"%s\",\n", status
      printf "  \"passed\": %d,\n", passed
      printf "  \"failed\": %d,\n", failed
      printf "  \"warnings\": %d,\n", warned
      printf "  \"violations\": %s,\n", violations_json
      printf "  \"timestamp\": \"%s\"\n", strftime("%Y-%m-%dT%H:%M:%SZ", systime(), 1)
      printf "}\n"
    }' > "$REPORT_FILE" 2>/dev/null || true

if [[ -f "$REPORT_FILE" ]]; then
  echo -e "\n  ${CYAN}JSON report: $REPORT_FILE${RESET}"
fi

# Cleanup
rm -f "$ALLOWED_FILE" "$ALL_HEX_FILE" "$FILTERED_FILE" "$VIOLATIONS_FILE"

if [[ $fail_count -gt 0 ]]; then
  echo -e "\n${RED}${BOLD}BRAND AUDIT: FAILED${RESET}"
  exit 1
else
  echo -e "\n${GREEN}${BOLD}BRAND AUDIT: PASSED${RESET} (warnings: $warn_count)"
  exit 0
fi