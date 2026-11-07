#!/usr/bin/env bash
# Install Ben Code by hand: build and publish the newest version, then replace /Applications/Ben Code.app.
#   ben/update_app.sh            sync upstream, build, install
#   ben/update_app.sh --no-sync  build and install the current branch
# Once installed, the app updates itself from the local feed (see publish_build.sh); you only need this
# script for the first install or to force an update right now. Never pushes.
set -euo pipefail
cd "$(dirname "$0")/.."

ben/publish_build.sh "$@"

zip=$(ls -t "$HOME"/.ben-code-build/out/*.zip | head -1)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
ditto -x -k "$zip" "$stage"
app="$stage/Ben Code.app"
if [ ! -d "$app" ]; then
  echo "Build finished but Ben Code.app was not in $zip" >&2
  exit 3
fi

if pgrep -xq "Ben Code"; then
  echo "Ben Code is open. It will offer the update itself; quit it first to install by hand." >&2
  exit 0
fi

rm -rf "/Applications/Ben Code.app"
ditto "$app" "/Applications/Ben Code.app"
echo "Installed /Applications/Ben Code.app from $(git rev-parse --short HEAD)"
