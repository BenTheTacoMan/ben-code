#!/usr/bin/env bash
# Bring Ben Code up to date locally: merge the fork's ben-code branch (CI merges upstream there nightly)
# and then the newest upstream T3 Code main, then prove it still builds. Never pushes.
# On a conflict it stops, aborts the merge and names the files.
set -euo pipefail
cd "$(dirname "$0")/.."

git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/pingdotgg/t3code.git
git remote set-url --push upstream no_push_to_upstream

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Uncommitted changes. Commit or stash them, then run this again." >&2
  exit 1
fi

git fetch --tags origin upstream
for ref in origin/ben-code upstream/main; do
  if ! git merge --no-edit "$ref"; then
    echo "Conflicts merging $ref in:" >&2
    git diff --name-only --diff-filter=U >&2 || true
    git merge --abort
    echo "Merge aborted; branch unchanged. Resolve by hand." >&2
    exit 2
  fi
done

if [ -f "$HOME/.config/vite-plus/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.config/vite-plus/env"
fi
vp i
(cd apps/web && vp run typecheck)
(cd apps/web && vp test run --project unit src/components/ben)
echo "Ben Code is at $(git rev-parse --short HEAD), upstream $(git rev-parse --short upstream/main)"
