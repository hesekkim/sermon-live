#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
app_executable="$script_dir/Sermon Live.app/Contents/MacOS/sermon-live"

if [[ ! -x "$app_executable" ]]; then
  echo "Sermon Live.app must be next to this launcher." >&2
  read -r -p "Press Return to close this window. "
  exit 1
fi

exec "$app_executable" "$@"
