#!/usr/bin/env bash
# backup.sh: one backup of the Strapi SQLite database and the uploaded files. Run by the systemd timer that
# 95-backup.sh installs (as root), or by hand. Parameters are environment variables (defaults below).
# NOT RUN ANYWHERE against a real box; backup-selftest.sh exercises it on a Mac against a stand-in database.
#
# Rules, in the order they matter:
#  1. A new set is built in a hidden temp folder, verified, and only then renamed into place. A failure at any
#     point leaves the earlier sets exactly as they were.
#  2. Old sets are deleted only AFTER a new verified set exists, never to make room. A full disk therefore
#     stops the backup (exit 4 or 5) and keeps every old set.
#  3. The copy is made with sqlite3's .backup, which takes a consistent snapshot while Strapi is writing
#     (it waits out a lock up to the timeout); a plain `cp` of a database being written can be torn.
#  4. The copy is checked (PRAGMA integrity_check = ok, and it has tables) before it counts.
# Exit: 0 ok | 2 bad setup | 3 no database | 4 not enough free space | 5 copy or verification failed | 6 off-box command failed (local set kept)
set -uo pipefail
: "${DATABASE_FILE:=/var/lib/strapi/data.db}"
: "${UPLOADS_DIR:=/opt/strapi/app/public/uploads}"
: "${BACKUP_DIR:=/var/backups/strapi}"
: "${BACKUP_KEEP:=14}"
: "${BACKUP_MIN_FREE_MB:=500}"
: "${SQLITE_TIMEOUT_MS:=30000}"
: "${OFFBOX_CMD:=}"
say() { printf '== %s\n' "$*"; }
die() { say "$2"; exit "$1"; }

case "$BACKUP_KEEP" in ''|*[!0-9]*) die 2 "BACKUP_KEEP must be a whole number";; esac
[ "$BACKUP_KEEP" -ge 1 ] || die 2 "BACKUP_KEEP must be at least 1"
command -v sqlite3 >/dev/null || die 2 "sqlite3 is not installed (apt-get install sqlite3)"
command -v rsync >/dev/null || die 2 "rsync is not installed (apt-get install rsync)"
[ -f "$DATABASE_FILE" ] || die 3 "no database at $DATABASE_FILE"
mkdir -p "$BACKUP_DIR" || die 2 "cannot create $BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

sha() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }
kb() { du -sk "$1" 2>/dev/null | cut -f1; }

# 4. space: free must cover the floor and three times what is copied (database, plus the uploads on first run)
need_kb=$(( ( $(kb "$DATABASE_FILE") + $(kb "$UPLOADS_DIR") ) * 3 ))
floor_kb=$(( BACKUP_MIN_FREE_MB * 1024 ))
[ "$need_kb" -ge "$floor_kb" ] || need_kb=$floor_kb
free_kb=$(df -Pk "$BACKUP_DIR" | awk 'NR==2{print $4}')
if [ "${FAKE_FREE_KB:-}" ]; then free_kb=$FAKE_FREE_KB; fi   # test hook only
[ "$free_kb" -ge "$need_kb" ] || die 4 "not enough free space in $BACKUP_DIR: ${free_kb} KB free, ${need_kb} KB needed. No set was made and no old set was deleted."

stamp=$(date +%Y%m%d-%H%M%S)
final="$BACKUP_DIR/strapi-$stamp"
tmp="$BACKUP_DIR/.tmp-$stamp-$$"
[ ! -e "$final" ] || die 5 "$final already exists (two runs in one second?)"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp" || die 5 "cannot make $tmp"

# 3. consistent snapshot of the live database
sqlite3 -cmd ".timeout $SQLITE_TIMEOUT_MS" "$DATABASE_FILE" ".backup '$tmp/data.db'" || die 5 "sqlite3 .backup failed (database locked longer than ${SQLITE_TIMEOUT_MS} ms, or the disk is full)"
# 4. verify the copy
[ "$(sqlite3 "$tmp/data.db" 'PRAGMA integrity_check;' 2>&1)" = ok ] || die 5 "the copy failed integrity_check; it was discarded"
[ "$(sqlite3 "$tmp/data.db" "select count(*) from sqlite_master where type='table';" 2>&1)" -gt 0 ] 2>/dev/null || die 5 "the copy has no tables; it was discarded"
gzip -c "$tmp/data.db" > "$tmp/data.db.gz" || die 5 "compressing the copy failed (disk full?)"
rm -f "$tmp/data.db"
gzip -t "$tmp/data.db.gz" || die 5 "the compressed copy is damaged"

# uploads: one mirror next to the sets, never deleting from it (a file removed in Strapi stays in the mirror)
if [ -d "$UPLOADS_DIR" ]; then
  mkdir -p "$BACKUP_DIR/uploads-mirror"
  rsync -a "$UPLOADS_DIR"/ "$BACKUP_DIR/uploads-mirror"/ || die 5 "copying the uploads failed (disk full?)"
fi

( cd "$tmp" && sha data.db.gz > SHA256SUMS ) || die 5 "checksum failed"
sync
mv "$tmp" "$final" || die 5 "could not move the finished set into place"
trap - EXIT
say "set $final: database $(wc -c < "$final/data.db.gz") bytes compressed"

# 2. only now may old sets go: keep the newest BACKUP_KEEP
n=0
for d in $(ls -1d "$BACKUP_DIR"/strapi-????????-?????? 2>/dev/null | sort -r); do
  n=$((n+1))
  if [ "$n" -gt "$BACKUP_KEEP" ]; then rm -rf "$d"; say "removed old set $d"; fi
done
find "$BACKUP_DIR" -maxdepth 1 -name '.tmp-*' -mtime +1 -exec rm -rf {} + 2>/dev/null

if [ -n "$OFFBOX_CMD" ]; then
  $OFFBOX_CMD "$final" || die 6 "the off-box command failed; the set on this box is kept"
fi
echo "BACKUP_OK $final kept=$(ls -1d "$BACKUP_DIR"/strapi-????????-?????? | wc -l)"
