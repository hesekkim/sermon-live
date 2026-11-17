#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must be run on macOS." >&2
  exit 1
fi

host_arch="$(uname -m)"
case "$host_arch" in
  arm64|x86_64) ;;
  *)
    echo "Unsupported macOS architecture: $host_arch" >&2
    exit 1
    ;;
esac

python="$project_root/backend/.venv/bin/python"
if [[ ! -x "$python" ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 is required on the build computer." >&2
    exit 1
  fi
  python3 -m venv "$project_root/backend/.venv"
fi

python_arch="$("$python" -c 'import platform; print(platform.machine())')"
if [[ "$python_arch" != "$host_arch" ]]; then
  echo "The Python environment is $python_arch, but this Mac is $host_arch." >&2
  echo "Create backend/.venv with a $host_arch Python interpreter." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required on the build computer." >&2
  exit 1
fi

cd "$project_root"
"$python" -m pip install \
  -r backend/requirements.txt \
  -r backend/requirements-packaging.txt
npm ci --prefix frontend
npm run --prefix frontend build

dist_dir="$project_root/dist/macos/$host_arch"
work_dir="$project_root/build/macos/$host_arch"
mkdir -p "$dist_dir" "$work_dir"

"$python" -m PyInstaller \
  --noconfirm \
  --clean \
  --distpath "$dist_dir" \
  --workpath "$work_dir" \
  packaging/macos/sermon_live.spec

app_path="$dist_dir/Sermon Live.app"
if [[ ! -d "$app_path" ]]; then
  echo "PyInstaller did not create $app_path" >&2
  exit 1
fi

stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/sermon-live-macos.XXXXXX")"
trap 'rm -rf "$stage_dir"' EXIT
ditto "$app_path" "$stage_dir/Sermon Live.app"
cp packaging/macos/README.txt "$stage_dir/README.txt"
cp "packaging/macos/Start Sermon Live.command" \
  "$stage_dir/Start Sermon Live.command"
chmod +x "$stage_dir/Start Sermon Live.command"

archive_path="$dist_dir/sermon-live-macos-$host_arch.dmg"
hdiutil create \
  -volname "Sermon Live $host_arch" \
  -srcfolder "$stage_dir" \
  -ov \
  -format UDZO \
  "$archive_path"

echo "Created $archive_path"
