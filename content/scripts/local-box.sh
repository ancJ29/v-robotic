#!/usr/bin/env bash
# One invocation that proves the whole local chain, then stops what it started (a sandboxed session
# cannot signal a Strapi that an earlier command left running, so up, checks and down live together):
#   fresh database -> Strapi up on 1337 -> admin and tokens -> seed imported (twice, to prove it is safe to rerun)
#   -> site reads Strapi and is compared with the seed -> optionally the site is built from Strapi.
# Needs `pnpm install` and `pnpm --filter cms build` done, and cms/.env present (see docs/conventions/strapi-local.md).
# Env: LOGDIR (default <repo>/logs), BUILD=1 to also run `astro build` with CONTENT_SOURCE=strapi, KEEP_DB=1 to skip the reset.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
LOGDIR="${LOGDIR:-$REPO/logs}"; mkdir -p "$LOGDIR"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@vrobotic.test}" ADMIN_PASSWORD="${ADMIN_PASSWORD:-LocalAdmin#2026}"
export STRAPI_URL=http://127.0.0.1:1337 STRAPI_TELEMETRY_DISABLED=true ASTRO_TELEMETRY_DISABLED=1
[ "${KEEP_DB:-0}" = 1 ] || rm -f "$REPO"/cms/.tmp/data.db*
cd "$REPO/cms" || exit 2
NODE_ENV=production ./node_modules/.bin/strapi start > "$LOGDIR/strapi.log" 2>&1 &
PID=$!
stop() { kill "$PID" 2>/dev/null; sleep 2; pkill -P "$PID" 2>/dev/null; echo "strapi stopped"; }
trap stop EXIT
up=0
for i in $(seq 1 90); do curl -s -o /dev/null "$STRAPI_URL/_health" && { up=1; break; }; sleep 2; done
[ "$up" = 1 ] || { echo "Strapi did not come up in 180 s; see $LOGDIR/strapi.log"; exit 3; }
echo "strapi up after about $((i*2)) s"
node "$HERE/strapi-bootstrap.mjs" || exit 4
set -a; . "$REPO/cms/.env.tokens"; set +a
node "$HERE/import-seed.mjs" vi || exit 5
node "$HERE/import-seed.mjs" vi || exit 5   # second run must update, not duplicate
echo "products in Strapi: $(curl -sg -H "Authorization: Bearer $STRAPI_TOKEN" "$STRAPI_URL/api/products?locale=vi&pagination[pageSize]=1" | node -pe 'JSON.parse(require("fs").readFileSync(0)).meta.pagination.total')"
node "$REPO/web/scripts/compare-with-seed.mjs" || exit 6
if [ "${BUILD:-0}" = 1 ]; then
  cd "$REPO/web" && CONTENT_SOURCE=strapi pnpm build > "$LOGDIR/web-build-strapi.log" 2>&1 || { echo "site build from Strapi FAILED; see $LOGDIR/web-build-strapi.log"; exit 7; }
  echo "site built from Strapi"
fi
