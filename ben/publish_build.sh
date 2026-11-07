#!/usr/bin/env bash
# Build Ben Code for macOS and publish it to the local update feed that the installed app reads.
#   ben/publish_build.sh            sync upstream, build, publish
#   ben/publish_build.sh --no-sync  build and publish the current branch
# The installed app checks http://127.0.0.1:47831 (served by launchd job com.ben.code-feed) and
# updates like any other Electron app. Builds are signed with the local certificate "Ben Code Local"
# so each update has the same code identity. Never pushes.
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"
if [ -f "$HOME/.config/vite-plus/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.config/vite-plus/env"
fi

signing="$HOME/Library/Keychains/ben-code.keychain-db"
security unlock-keychain -p bencode "$signing"
export BEN_CODE_SIGN_IDENTITY="Ben Code Local"
export CSC_KEYCHAIN="$signing"

if [ "${1:-}" != "--no-sync" ]; then
  ben/sync_upstream.sh
fi

base=$(node -p "require('./apps/desktop/package.json').version.split('-')[0]")
version="${base}-ben.$(date -u +%Y%m%d%H%M)"
out="$HOME/.ben-code-build/out"
feed="$HOME/.ben-code-build/feed"
rm -rf "$out"
mkdir -p "$out" "$feed"

T3CODE_DESKTOP_VERSION="$version" T3CODE_DESKTOP_OUTPUT_DIR="$out" \
  node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch arm64

# Copy installers first and the manifest last, so a client never sees a manifest without its files.
for file in "$out"/*.zip "$out"/*.zip.blockmap "$out"/*.dmg "$out"/*.dmg.blockmap; do
  [ -f "$file" ] && cp "$file" "$feed/"
done
# electron-builder names the manifest after the version's prerelease tag ("ben"); publish it under
# both names so the updater finds it whichever channel it asks for.
manifest=$(ls "$out"/*-mac.yml | grep -v builder-debug | head -1)
for name in ben-mac.yml latest-mac.yml; do
  cp "$manifest" "$feed/$name.tmp"
  mv "$feed/$name.tmp" "$feed/$name"
done

# Keep the three newest builds.
ls -t "$feed"/*.zip 2>/dev/null | tail -n +4 | while read -r old; do
  rm -f "$old" "$old.blockmap" "${old%.zip}.dmg" "${old%.zip}.dmg.blockmap"
done
echo "Published Ben Code ${version} to ${feed}"
