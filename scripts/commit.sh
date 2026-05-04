#!/usr/bin/env bash
# Stage all changes, commit, and optionally push.
# Usage:
#   ./scripts/commit.sh "Your commit message"
#   ./scripts/commit.sh "Your commit message" push

set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

if ! command -v git >/dev/null 2>&1; then
  echo "git not found in PATH" >&2
  exit 1
fi

msg="${1:?Usage: $0 \"commit message\" [push]}"
git add -A
if [[ -z "$(git status --porcelain)" ]]; then
  echo "Nothing to commit (working tree clean)."
  exit 0
fi

git commit -m "$msg"
if [[ "${2:-}" == "push" ]]; then
  git push
fi
