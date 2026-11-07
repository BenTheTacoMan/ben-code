#!/usr/bin/env bash
# Run Ben Code from source on a COPY of your T3 data, so the nightly app is never touched.
#
#   ben/run.sh            start (seeds ~/.t3-ben from ~/.t3 on first run) and print the pairing URL
#   ben/run.sh --reseed   throw the copy away and snapshot ~/.t3 again
#   BEN_CODE_HOME=~/.t3 ben/run.sh   run on your real data (do not run the nightly app at the same time)
#
# The copy has your projects, threads and settings as of the snapshot; it does not stay in sync.
set -euo pipefail
cd "$(dirname "$0")/.."
SOURCE="$HOME/.t3/userdata"
HOME_DIR="${BEN_CODE_HOME:-$HOME/.t3-ben}"

if [ "${1:-}" = "--reseed" ]; then
  [ "$HOME_DIR" = "$HOME/.t3" ] && { echo "Refusing to reseed your real data directory." >&2; exit 1; }
  rm -rf "$HOME_DIR"
fi

if [ ! -d "$HOME_DIR/userdata" ]; then
  echo "Seeding $HOME_DIR from $SOURCE ..."
  mkdir -p "$HOME_DIR/userdata"
  chmod 700 "$HOME_DIR" "$HOME_DIR/userdata"
  for name in settings.json keybindings.json keybindings-migrations model-manifest.json themes secrets attachments; do
    [ -e "$SOURCE/$name" ] && cp -R "$SOURCE/$name" "$HOME_DIR/userdata/$name"
  done
  # A live SQLite file cannot be copied safely; ask SQLite for a consistent snapshot.
  sqlite3 "$SOURCE/statev2.sqlite" ".backup '$HOME_DIR/userdata/statev2.sqlite'"
fi

if [ -f "$HOME/.config/vite-plus/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.config/vite-plus/env"
fi

echo "Ben Code data: $HOME_DIR"
# Without the explicit false, dev mode registers this repository as a project in a running T3 app.
exec node scripts/dev-runner.ts dev --home-dir "$HOME_DIR" --auto-bootstrap-project-from-cwd=false
