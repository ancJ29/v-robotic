#!/usr/bin/env bash
# Step 60: the systemd unit for Strapi, enabled so it starts at boot, started now.
# systemd, not pm2: it is what S0b measured, it ships with the box, and it needs no Node process of its own.
# NOT RUN ANYWHERE against a real box.
set -euo pipefail
. "$(dirname "$0")/params.sh"
need_root_linux
render_unit | write_file "/etc/systemd/system/$SERVICE_NAME.service" 644 root:root
run systemctl daemon-reload
run systemctl enable "$SERVICE_NAME"
run systemctl restart "$SERVICE_NAME"
[ "$DRY_RUN" = 1 ] && exit 0
say "waiting for /_health (up to $HEALTH_WAIT_SECONDS s)"
end=$(( $(date +%s) + HEALTH_WAIT_SECONDS ))
until [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/_health")" = 204 ]; do
  if [ "$(date +%s)" -ge "$end" ]; then
    say "not ready; last service log lines:"; journalctl -u "$SERVICE_NAME" --no-pager | tail -n 40; exit 3
  fi
  sleep 2
done
say "Strapi is healthy on 127.0.0.1:$PORT"
