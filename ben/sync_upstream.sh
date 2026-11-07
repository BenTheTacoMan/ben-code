#!/usr/bin/env bash
# Rebase Ben Code onto the newest upstream T3 Code main, then prove it still builds.
# Ben Code keeps all of its own code in apps/web/src/components/ben, apps/web/src/routes/_chat.board.tsx
# and ben/, plus two small hooks in AppSidebarLayout.tsx, so a rebase usually has nothing to resolve.
# Never pushes. On a conflict it stops, aborts the rebase and tells you which files collided.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream https://github.com/pingdotgg/t3code.git
fi
git remote set-url --push upstream no_push_to_upstream

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Uncommitted changes. Commit or stash them, then run this again." >&2
  exit 1
fi

git fetch --tags upstream
before=$(git rev-parse --short HEAD)
if ! git rebase upstream/main; then
  echo "Conflicts in:" >&2
  git diff --name-only --diff-filter=U >&2 || true
  git rebase --abort
  echo "Rebase aborted; branch unchanged at ${before}. Resolve by hand." >&2
  exit 2
fi

# routeTree.gen.ts is generated; rebuild it so the board route stays registered.
if [ -x "$HOME/.config/vite-plus/env" ] || [ -f "$HOME/.config/vite-plus/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.config/vite-plus/env"
fi
vp i
(cd apps/web && vp run typecheck)
(cd apps/web && vp test run --project unit src/components/ben)
echo "Ben Code is on upstream $(git describe --tags --abbrev=0 upstream/main 2>/dev/null || git rev-parse --short upstream/main): $(git rev-parse --short HEAD)"
