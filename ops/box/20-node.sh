#!/usr/bin/env bash
# Step 20: Node from nodejs.org into NODE_DIR, checked against the published sha256 (S0b's method).
# NOT RUN ANYWHERE against a real box.
set -euo pipefail
. "$(dirname "$0")/params.sh"
need_root_linux
if [ "$DRY_RUN" != 1 ] && [ -x "$NODE_DIR/bin/node" ] && "$NODE_DIR/bin/node" -v | grep -q "^v$NODE_MAJOR\."; then
  say "Node $NODE_MAJOR already installed: $("$NODE_DIR/bin/node" -v)"; exit 0
fi
say "installing Node $NODE_MAJOR into $NODE_DIR"
if [ "$DRY_RUN" = 1 ]; then say "would download latest-v$NODE_MAJOR.x linux-x64, check sha256, unpack to $NODE_DIR"; exit 0; fi
base="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
w=$(mktemp -d); trap 'rm -rf "$w"' EXIT
cd "$w"
curl -fsSL "$base/SHASUMS256.txt" -o SHASUMS256.txt
f=$(awk '/linux-x64\.tar\.xz$/ {print $2}' SHASUMS256.txt)
[ -n "$f" ] || refuse "no linux-x64 tarball in the published checksums"
curl -fsSL "$base/$f" -o "$f"
grep " $f\$" SHASUMS256.txt | sha256sum -c -
mkdir -p "$NODE_DIR"
tar -xJf "$f" -C "$NODE_DIR" --strip-components=1
"$NODE_DIR/bin/node" -v
