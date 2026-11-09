#!/usr/bin/env bash
# run-all.sh: the whole box, in order, on a fresh Ubuntu box, as root. Idempotent: safe to run again.
#   sudo env DOMAIN=... ADMIN_EMAIL=... bash /path/to/ops/box/run-all.sh
# Every parameter is in params.sh with its default. DRY_RUN=1 prints instead of changing.
# NOT RUN ANYWHERE against a real box. Order matters: the admin is registered while Strapi is still
# localhost-only, and Caddy (the public door) opens last.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/params.sh"
[ -n "$DOMAIN" ] || refuse "no DOMAIN"
[ -n "$ADMIN_EMAIL" ] || refuse "no ADMIN_EMAIL"
for s in 10-swap 20-node 30-account 40-unpack 50-env 60-service 80-admin 70-caddy 90-ssh 95-backup; do
  say "step $s"
  bash "$here/$s.sh"
done
[ "$DRY_RUN" = 1 ] && { say "dry run finished"; exit 0; }
bash "$here/verify.sh"
echo SETUP_OK
