#!/bin/bash

# Commit script for roninmemory
# Usage: bash commit.sh ["commit message"]

set -e

echo "=== roninmemory Commit Script ==="

# Default commit message if none provided
if [ -z "$1" ]; then
    COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
else
    COMMIT_MSG="$1"
fi

echo "Commit message: $COMMIT_MSG"

# Check git status
echo ""
echo "--- Current Git Status ---"
git status --short

# Check for untracked files
echo ""
echo "--- Checking for new files ---"
UNTRACKED=$(git ls-files --others --exclude-standard)
if [ -n "$UNTRACKED" ]; then
    echo "Found untracked files:"
    echo "$UNTRACKED"
    echo ""
    read -p "Add all untracked files? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
    fi
else
    echo "No untracked files found"
fi

# Stage modified files
echo ""
echo "--- Staging modified files ---"
git add -u

# Show what's staged
echo ""
echo "--- Staged for commit ---"
git diff --cached --stat

# Commit
echo ""
echo "--- Committing ---"
git commit -m "$COMMIT_MSG"

# Push
echo ""
echo "--- Pushing to origin ---"
git push origin $(git branch --show-current)

echo ""
echo "=== Done! ==="
echo "Commit: $COMMIT_MSG"
echo "Branch: $(git branch --show-current)"
