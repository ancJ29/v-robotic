#!/usr/bin/env bash
# selftest.sh: tests everything in ops/box that can be tested without a box: syntax, the rendered unit,
# Caddyfile and env text, gen-env.js (secrets kept across runs, mode 600), the refusals, and a dry run.
# Runs on a Mac or Linux, changes nothing outside a temp folder. Exit 0 = all pass.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
t=$(mktemp -d "${TMPDIR:-/tmp}/boxtest.XXXXXX"); trap 'rm -rf "$t"' EXIT
fails=0
ok() { printf 'PASS %s\n' "$1"; }
ko() { printf 'FAIL %s\n' "$1"; fails=$((fails+1)); }
t_() { if eval "$2"; then ok "$1"; else ko "$1"; fi; }

for f in "$here"/*.sh; do t_ "bash -n $(basename "$f")" "bash -n '$f'"; done
if command -v shellcheck >/dev/null; then t_ "shellcheck (errors only)" "shellcheck -S error '$here'/*.sh"; fi

( . "$here/params.sh"; DOMAIN=203-0-113-7.sslip.io; ACME_EMAIL=a@b.co
  u=$(render_unit); c=$(render_caddyfile); e=$(render_env_params)
  # the lesson of S0b: the shim is the program, never an argument to node
  printf '%s\n' "$u" | grep -q '^ExecStart=/opt/strapi/app/node_modules/.bin/strapi start$' || exit 1
  printf '%s\n' "$u" | grep -q 'ExecStart=.*node ' && exit 2
  printf '%s\n' "$u" | grep -q '^Environment=PATH=/opt/node/bin:' || exit 3
  printf '%s\n' "$u" | grep -q '^Environment=NODE_OPTIONS=--max-old-space-size=320$' || exit 4
  printf '%s\n' "$u" | grep -q '^User=strapi$' || exit 5
  printf '%s\n' "$c" | grep -q 'reverse_proxy 127.0.0.1:1337' || exit 6
  printf '%s\n' "$c" | grep -q '^203-0-113-7.sslip.io {$' || exit 7
  printf '%s\n' "$e" | grep -q '^HOST=127.0.0.1$' || exit 8
  printf '%s\n' "$e" | grep -q '^PUBLIC_URL=https://203-0-113-7.sslip.io$' || exit 9
  DOMAIN='' render_caddyfile >/dev/null && exit 10
  exit 0 ); rc=$?
t_ "rendered unit/Caddyfile/env are right (rc=$rc)" "[ $rc = 0 ]"

( . "$here/params.sh"; DOMAIN=x.example; render_env_params > "$t/p"; export P="$t/p"
  command -v node >/dev/null || exit 99
  node "$here/gen-env.js" "$t/env" "$t/p" >/dev/null || exit 1
  [ "$(grep -cE '^(APP_KEYS|API_TOKEN_SALT|ADMIN_JWT_SECRET|TRANSFER_TOKEN_SALT|JWT_SECRET|ENCRYPTION_KEY)=' "$t/env")" = 6 ] || exit 2
  m=$(stat -c %a "$t/env" 2>/dev/null || stat -f %Lp "$t/env"); [ "$m" = 600 ] || exit 3
  a=$(grep '^JWT_SECRET=' "$t/env"); node "$here/gen-env.js" "$t/env" "$t/p" >/dev/null
  [ "$a" = "$(grep '^JWT_SECRET=' "$t/env")" ] || exit 4         # secrets survive a re-run
  printf 'JWT_SECRET=p5localjwtsecret\n' > "$t/env"; node "$here/gen-env.js" "$t/env" "$t/p" >/dev/null
  ! grep -q p5local "$t/env" || exit 5                           # a throwaway value is replaced, never kept
  exit 0 ); rc=$?
t_ "gen-env.js: 6 secrets, mode 600, kept on re-run, throwaway replaced (rc=$rc)" "[ $rc = 0 ]"

t_ "40-unpack skips when the app is in place and no tarball is left (re-runnable)" "grep -q 'step skipped' '$here/40-unpack.sh' && grep -q '\.strapi; do' '$here/40-unpack.sh'"
t_ "90-ssh falls back when ssh.service is inactive" "grep -q 'try-restart ssh.socket' '$here/90-ssh.sh'"
t_ "verify retries the https check" "grep -q 'https_ok' '$here/verify.sh'"
t_ "step refuses off the box (exit 2)" "bash '$here/10-swap.sh' >/dev/null 2>&1; [ \$? = 2 ]"
t_ "run-all refuses without DOMAIN (exit 2)" "env -u DOMAIN -u ADMIN_EMAIL bash '$here/run-all.sh' >/dev/null 2>&1; [ \$? = 2 ]"
t_ "admin step refuses the throwaway email (exit 2)" "DRY_RUN=0 DOMAIN=x ADMIN_EMAIL=admin@vrobotic.test bash '$here/80-admin.sh' >/dev/null 2>&1; [ \$? = 2 ]"
t_ "dry run of the whole box prints and changes nothing" "DRY_RUN=1 DOMAIN=x.example ADMIN_EMAIL=a@b.co bash '$here/run-all.sh' 2>&1 | grep -q 'dry run finished'"
t_ "backup-selftest.sh passes (needs sqlite3 and rsync)" "bash '$here/backup-selftest.sh' 2>&1 | tail -1 | grep -q BACKUP_SELFTEST_OK"
[ "$fails" = 0 ] && echo "SELFTEST_OK" || echo "SELFTEST_FAILED: $fails"
exit $((fails>0))
