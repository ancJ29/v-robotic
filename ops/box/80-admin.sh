#!/usr/bin/env bash
# Step 80: the first admin account, with a password generated here. Skipped if an admin exists.
# The login goes to ADMIN_LOGIN_FILE (root-owned, mode 600); nothing is printed. NOT RUN ANYWHERE against a real box
# (the register-admin call is S0b's, which did run).
set -euo pipefail
. "$(dirname "$0")/params.sh"
[ -n "$ADMIN_EMAIL" ] || refuse "no ADMIN_EMAIL (the address the client or you will log in with)"
case "$ADMIN_EMAIL" in *?@?*.?*) : ;; *) refuse "ADMIN_EMAIL does not look like an address" ;; esac
case "$ADMIN_EMAIL" in *vrobotic.test*) refuse "ADMIN_EMAIL is the throwaway local admin" ;; esac
need_root_linux
if [ "$DRY_RUN" = 1 ]; then say "would register $ADMIN_EMAIL with a generated password into $ADMIN_LOGIN_FILE"; exit 0; fi
has=$(curl -fsS "http://127.0.0.1:$PORT/admin/init" | grep -o '"hasAdmin":[a-z]*' | cut -d: -f2)
if [ "$has" = true ]; then say "an admin already exists; nothing changed"; exit 0; fi
umask 077
pass="Aa1$(openssl rand -hex 12)"
body=$(mktemp "$ENV_DIR/reg.XXXXXX"); trap 'rm -f "$body"' EXIT
printf '{"email":"%s","password":"%s","firstname":"%s","lastname":"%s"}' "$ADMIN_EMAIL" "$pass" "$ADMIN_FIRSTNAME" "$ADMIN_LASTNAME" > "$body"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data-binary "@$body" "http://127.0.0.1:$PORT/admin/register-admin")
[ "$code" = 200 ] || { say "register-admin answered HTTP $code"; exit 4; }
printf '%s\n%s\n' "$ADMIN_EMAIL" "$pass" > "$ADMIN_LOGIN_FILE"
chown root:root "$ADMIN_LOGIN_FILE"; chmod 600 "$ADMIN_LOGIN_FILE"
say "admin created; login saved in $ADMIN_LOGIN_FILE (root-only; line 1 email, line 2 password)"
