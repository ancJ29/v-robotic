#!/usr/bin/env bash
# backup-selftest.sh: exercises backup.sh against a stand-in database in a temp folder. Needs sqlite3 and rsync.
# Proves: a good run, rotation (keeps the newest N, only after a verified new set), a full disk (exit 4, nothing
# deleted), a database being written during the copy (snapshot still verifies), a corrupt source (exit 5, nothing
# deleted), a missing database, and a failing off-box command (exit 6, set kept).
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
t=$(mktemp -d "${TMPDIR:-/tmp}/backuptest.XXXXXX"); trap 'rm -rf "$t"' EXIT
fails=0
ok() { printf 'PASS %s\n' "$1"; }
ko() { printf 'FAIL %s\n' "$1"; fails=$((fails+1)); }
t_() { if eval "$2"; then ok "$1"; else ko "$1"; fi; }
command -v sqlite3 >/dev/null && command -v rsync >/dev/null || { echo "needs sqlite3 and rsync"; exit 2; }

db="$t/data.db"; up="$t/uploads"; bk="$t/bk"
mkdir -p "$up"; echo img > "$up/a.svg"
sqlite3 "$db" "create table products(id integer primary key, name text); insert into products(name) values ('x'),('y');"
export DATABASE_FILE="$db" UPLOADS_DIR="$up" BACKUP_DIR="$bk" BACKUP_MIN_FREE_MB=1
sets() { ls -1d "$bk"/strapi-????????-?????? 2>/dev/null | wc -l | tr -d ' '; }
mk_old() { for d in "$@"; do mkdir -p "$bk/strapi-$d"; echo old > "$bk/strapi-$d/data.db.gz"; done; }

BACKUP_KEEP=3 bash "$here/backup.sh" > "$t/o1" 2>&1; rc=$?
t_ "first run: exit 0, one set, mirror holds the upload (rc=$rc)" "[ $rc = 0 ] && [ \$(sets) = 1 ] && [ -f '$bk/uploads-mirror/a.svg' ]"
s1=$(ls -1d "$bk"/strapi-*-* | head -1)
t_ "the stored copy restores to the same rows" "[ \"\$(gzip -dc '$s1/data.db.gz' > '$t/r.db'; sqlite3 '$t/r.db' 'select count(*) from products')\" = 2 ] && (cd '$s1' && (sha256sum -c SHA256SUMS >/dev/null 2>&1 || shasum -a 256 -c SHA256SUMS >/dev/null 2>&1))"

# rotation: 5 old sets exist, keep 3 -> the 3 newest of all remain, the new one among them
rm -rf "$bk"/strapi-*; mk_old 20200101-000001 20200102-000001 20200103-000001 20200104-000001 20200105-000001
BACKUP_KEEP=3 bash "$here/backup.sh" > "$t/o2" 2>&1; rc=$?
left=$(ls -1d "$bk"/strapi-* | xargs -n1 basename | tr '\n' ' ')
t_ "rotation keeps the newest 3 (rc=$rc, left: $left)" "[ $rc = 0 ] && [ \$(sets) = 3 ] && [ ! -e '$bk/strapi-20200101-000001' ] && [ ! -e '$bk/strapi-20200103-000001' ] && [ -e '$bk/strapi-20200105-000001' ] && [ -e '$bk/strapi-20200104-000001' ]"

# full disk: old sets must all survive, no new set appears
before=$(sets)
FAKE_FREE_KB=10 BACKUP_KEEP=1 bash "$here/backup.sh" > "$t/o3" 2>&1; rc=$?
t_ "full disk: exit 4, nothing deleted, no new set (rc=$rc)" "[ $rc = 4 ] && [ \$(sets) = $before ] && grep -q 'not enough free space' '$t/o3'"
ls "$bk" | grep -q '^\.tmp-' && ko "no temp folder is left behind after a refusal" || ok "no temp folder is left behind after a refusal"

# database being written during the copy: a writer inserts in a loop while backups run
( for i in $(seq 1 300); do sqlite3 -cmd '.timeout 5000' "$db" "insert into products(name) values ('w$i');" 2>/dev/null; done ) &
w=$!
sleep 1   # sets are named by the second
good=0; bad=0
for i in 1 2 3 4 5; do
  if BACKUP_KEEP=50 bash "$here/backup.sh" > "$t/o4" 2>&1; then good=$((good+1)); else bad=$((bad+1)); cat "$t/o4"; fi
  sleep 1   # sets are named by the second
done
wait "$w"
last=$(ls -1d "$bk"/strapi-* | sort | tail -1)
t_ "backups taken while the database is written all verify ($good ok, $bad failed)" "[ $bad = 0 ] && gzip -dc '$last/data.db.gz' > '$t/w.db' && [ \"\$(sqlite3 '$t/w.db' 'pragma integrity_check')\" = ok ]"

sleep 1
# corrupt source (not a database): exit 5, no new set, nothing deleted
before=$(sets)
cp "$db" "$t/good.db"; head -c 3000 /dev/urandom > "$db"
BACKUP_KEEP=1 bash "$here/backup.sh" > "$t/o5" 2>&1; rc=$?
t_ "corrupt database: exit 5, nothing deleted (rc=$rc)" "[ $rc = 5 ] && [ \$(sets) = $before ]"
cp "$t/good.db" "$db"

# missing database
DATABASE_FILE="$t/none.db" bash "$here/backup.sh" > "$t/o6" 2>&1; rc=$?
t_ "missing database: exit 3 (rc=$rc)" "[ $rc = 3 ]"
# bad keep
BACKUP_KEEP=0 bash "$here/backup.sh" > "$t/o7" 2>&1; rc=$?
t_ "BACKUP_KEEP=0 is refused: exit 2 (rc=$rc)" "[ $rc = 2 ]"
# off-box command failing keeps the local set
sleep 1; before=$(sets)
BACKUP_KEEP=50 OFFBOX_CMD=false bash "$here/backup.sh" > "$t/o8" 2>&1; rc=$?
t_ "failing off-box command: exit 6, local set kept (rc=$rc)" "[ $rc = 6 ] && [ \$(sets) = $((before+1)) ]"

# rendered units
( unset DATABASE_FILE UPLOADS_DIR BACKUP_DIR; . "$here/params.sh"
  render_backup_timer | grep -q '^Persistent=true$' || exit 1
  render_backup_service | grep -q "^ExecStart=/usr/local/sbin/strapi-backup$" || exit 2
  render_backup_service | grep -q "DATABASE_FILE=/var/lib/strapi/data.db" || exit 3 ); rc=$?
t_ "rendered service and timer are right (rc=$rc)" "[ $rc = 0 ]"
t_ "95-backup dry run prints and changes nothing" "DRY_RUN=1 bash '$here/95-backup.sh' 2>&1 | grep -q 'would run: systemctl enable --now strapi-backup.timer'"
[ "$fails" = 0 ] && echo "BACKUP_SELFTEST_OK" || echo "BACKUP_SELFTEST_FAILED: $fails"
exit $((fails>0))
