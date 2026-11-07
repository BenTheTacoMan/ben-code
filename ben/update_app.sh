#!/usr/bin/env bash
# Update Ben Code: pull the newest upstream T3 Code, rebase, build the macOS app and install it.
#   ben/update_app.sh            sync upstream, build, install to /Applications/Ben Code.app
#   ben/update_app.sh --no-sync  build and install the current branch without fetching upstream
# Never pushes. If the app is open, it is quit first and relaunched after the copy.
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"
if [ -f "$HOME/.config/vite-plus/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.config/vite-plus/env"
fi

if [ "${1:-}" != "--no-sync" ]; then
  ben/sync_upstream.sh
fi

out="$HOME/.ben-code-build/out"
rm -rf "$out"
mkdir -p "$out"
T3CODE_DESKTOP_OUTPUT_DIR="$out" node scripts/build-desktop-artifact.ts --platform mac --target dir --arch arm64

app=$(find "$out" -maxdepth 3 -name "Ben Code.app" -print -quit)
if [ -z "$app" ]; then
  echo "Build finished but Ben Code.app was not found in $out" >&2
  exit 3
fi

was_running=0
if pgrep -xq "Ben Code"; then
  was_running=1
  osascript -e 'tell application "Ben Code" to quit' 2>/dev/null || true
  for _ in $(seq 1 10); do pgrep -xq "Ben Code" || break; sleep 1; done
  # Quit by Apple event can time out; SIGTERM is the same as Cmd-Q for Electron.
  pkill -TERM -f "/Applications/Ben Code.app/Contents/MacOS/Ben Code" || true
  for _ in $(seq 1 10); do pgrep -xq "Ben Code" || break; sleep 1; done
fi

rm -rf "/Applications/Ben Code.app"
ditto "$app" "/Applications/Ben Code.app"
# The build is unsigned; an ad-hoc signature makes the bundle valid so macOS opens it without a prompt.
codesign --force --deep -s - "/Applications/Ben Code.app"
echo "Installed /Applications/Ben Code.app from $(git rev-parse --short HEAD)"
if pgrep -xq "Ben Code"; then
  echo "Ben Code is still open (it may be holding quit for a running thread). Quit and reopen it to use the new build."
elif [ "$was_running" = 1 ]; then
  open "/Applications/Ben Code.app"
fi
