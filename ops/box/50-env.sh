#!/usr/bin/env bash
# Step 50: the box's environment file. Secrets generated here by gen-env.js (kept on a re-run), mode 600,
# root-owned, never printed. Refuses any throwaway value from P5.
# NOT RUN ANYWHERE against a real box (gen-env.js itself is exercised by selftest.sh on a Mac).
set -euo pipefail
. "$(dirname "$0")/params.sh"
need_root_linux
here=$(cd "$(dirname "$0")" && pwd)
say "environment file $ENV_FILE (root-owned, mode 600; secrets generated here, never printed)"
if [ "$DRY_RUN" = 1 ]; then render_env_params | sed 's/^/   | /'; say "would add six generated secrets"; exit 0; fi
umask 077
p=$(mktemp "$ENV_DIR/params.XXXXXX"); trap 'rm -f "$p"' EXIT
render_env_params > "$p"
"$NODE_DIR/bin/node" "$here/gen-env.js" "$ENV_FILE" "$p"
chown root:root "$ENV_FILE"; chmod 600 "$ENV_FILE"
if grep -qE 'p5local|LocalAdmin|vrobotic\.test|=replace' "$ENV_FILE"; then
  rm -f "$ENV_FILE"; refuse "a throwaway or placeholder value reached the env file; it was removed"
fi
n=$(grep -cE "^($(echo $SECRET_KEYS | tr ' ' '|'))=" "$ENV_FILE")
say "secrets present: $n of 6"; [ "$n" = 6 ]
