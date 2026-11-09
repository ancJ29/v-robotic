#!/usr/bin/env bash
# verify.sh: read-only checks of a finished box; prints PASS/FAIL lines and "VERIFY_OK" when all pass.
# Safe to run any time, also after a reboot. NOT RUN ANYWHERE against a real box.
set -uo pipefail
. "$(dirname "$0")/params.sh"
need_root_linux
bad=0
chk() { if eval "$2" >/dev/null 2>&1; then say "PASS $1"; else say "FAIL $1"; bad=$((bad+1)); fi; }
chk "swap active ($SWAP_FILE)" "swapon --show --noheadings | grep -q '$SWAP_FILE'"
chk "swap is in fstab (survives reboot)" "grep -q '^$SWAP_FILE ' /etc/fstab"
chk "swappiness is $SWAPPINESS" "[ \"\$(cat /proc/sys/vm/swappiness)\" = $SWAPPINESS ]"
chk "$SERVICE_NAME is enabled at boot" "systemctl is-enabled --quiet $SERVICE_NAME"
chk "$SERVICE_NAME is running" "systemctl is-active --quiet $SERVICE_NAME"
chk "$SERVICE_NAME runs as $SERVICE_USER" "[ \"\$(ps -o user= -p \$(systemctl show -p MainPID --value $SERVICE_NAME))\" = $SERVICE_USER ]"
chk "no restarts since start" "[ \"\$(systemctl show -p NRestarts --value $SERVICE_NAME)\" = 0 ]"
chk "/_health answers 204" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/_health)\" = 204 ]"
chk "Strapi listens on 127.0.0.1 only" "ss -ltnH | grep -q '127.0.0.1:$PORT' && ! ss -ltnH | grep -qE '(0.0.0.0|\\*|\\[::\\]):$PORT'"
chk "env file is root:root mode 600" "[ \"\$(stat -c '%U:%G %a' $ENV_FILE)\" = 'root:root 600' ]"
chk "env file holds no throwaway value" "! grep -qE 'p5local|LocalAdmin|vrobotic.test|=replace' $ENV_FILE"
chk "database is outside the app folder" "[ -f $DATABASE_FILE ]"
chk "caddy is enabled and running" "systemctl is-enabled --quiet caddy && systemctl is-active --quiet caddy"
# Caddy asks for the certificate on the first visit, which takes up to about a minute: retry for ~90 s
https_ok() {
  local end=$(( $(date +%s) + ${HTTPS_WAIT_SECONDS:-90} )) code
  while :; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOMAIN/admin/")
    case "$code" in 200|301|302) return 0 ;; esac
    [ "$(date +%s)" -lt "$end" ] || return 1
    sleep 5
  done
}
if [ -n "$DOMAIN" ]; then chk "https://$DOMAIN/admin answers (retried for up to ${HTTPS_WAIT_SECONDS:-90} s)" https_ok; fi
free -m | head -2
[ "$bad" = 0 ] && say "VERIFY_OK" || say "VERIFY_FAILED: $bad check(s)"
exit $((bad>0))
