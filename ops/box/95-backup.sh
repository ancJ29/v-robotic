#!/usr/bin/env bash
# Step 95: the nightly backup. Installs the packages it needs, the backup program, a systemd service and a
# timer (Persistent: a night the box was off is made up at next boot), and takes one backup now to prove it.
# systemd timer rather than cron: the box already runs systemd, it logs to journalctl, and it can catch up.
# NOT RUN ANYWHERE against a real box.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/params.sh"
need_root_linux
run apt-get install -y sqlite3 rsync
run install -m 755 -o root -g root "$here/backup.sh" "$BACKUP_BIN"
run install -d -m 700 -o root -g root "$BACKUP_DIR"
render_backup_service | write_file "/etc/systemd/system/$SERVICE_NAME-backup.service" 644 root:root
render_backup_timer | write_file "/etc/systemd/system/$SERVICE_NAME-backup.timer" 644 root:root
run systemctl daemon-reload
run systemctl enable --now "$SERVICE_NAME-backup.timer"
[ "$DRY_RUN" = 1 ] && exit 0
say "taking one backup now"
run systemctl start "$SERVICE_NAME-backup.service" || { journalctl -u "$SERVICE_NAME-backup" --no-pager | tail -n 20; exit 3; }
journalctl -u "$SERVICE_NAME-backup" --no-pager | tail -n 3
