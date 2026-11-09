#!/usr/bin/env bash
# Step 70: Caddy in front (80/443, automatic https), from Caddy's own apt repository.
# Run LAST: until now Strapi is reachable only on 127.0.0.1, which is when the first admin is registered.
# NOT RUN ANYWHERE against a real box, including the apt lines (copied from Caddy's install page, not S0b).
set -euo pipefail
. "$(dirname "$0")/params.sh"
need_root_linux
[ -n "$DOMAIN" ] || refuse "no DOMAIN (for example 203-0-113-7.sslip.io, or a real name that points at this box)"
if [ "$DRY_RUN" != 1 ] && ! command -v caddy >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
elif [ "$DRY_RUN" = 1 ]; then say "would install caddy from Caddy's apt repository if missing"; fi
render_caddyfile | write_file /etc/caddy/Caddyfile 644 root:root
[ "$DRY_RUN" = 1 ] || caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
run systemctl enable caddy
run systemctl restart caddy
say "Caddy serves https://$DOMAIN -> 127.0.0.1:$PORT (certificate is requested on the first visit; allow a minute)"
