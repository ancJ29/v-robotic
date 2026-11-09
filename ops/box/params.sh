# shellcheck shell=bash disable=SC2034
# ops/box/params.sh - every per-box value, with its default. Sourced by every step; never run alone.
# Override any of these by setting the variable of the same name before the step runs.
#
# NOT RUN ANYWHERE: nothing in ops/box has ever been run against a real box. It is written from the
# commands S0b ran (docs/conventions/spike-512mb.md) and tested only for syntax, rendering and dry runs
# on a Mac (docs/conventions/box.md says exactly which). The first real run is the human's.

: "${SWAP_FILE:=/swapfile}"
: "${SWAP_GB:=2}"                       # S0b's finding is "512 MB plus 2 GB swap"; less is not that result
: "${SWAPPINESS:=10}"
: "${NODE_MAJOR:=24}"                   # same major as .nvmrc
: "${NODE_DIR:=/opt/node}"
: "${SERVICE_NAME:=strapi}"
: "${SERVICE_USER:=strapi}"             # system account: no login, no shell, owns only the data and upload folders
: "${APP_DIR:=/opt/strapi/app}"         # the unpacked artifact; root-owned code
: "${DATA_DIR:=/var/lib/strapi}"        # SQLite lives here, outside the deploy folder
: "${DATABASE_FILE:=$DATA_DIR/data.db}"
: "${ENV_DIR:=/etc/strapi}"
: "${ENV_FILE:=$ENV_DIR/strapi.env}"                 # the box's secrets: root-owned, mode 600
: "${ADMIN_LOGIN_FILE:=$ENV_DIR/admin-login.txt}"    # first admin's login: root-owned, mode 600
: "${TARBALL:=/home/ubuntu/cms.tar.gz}"
: "${PORT:=1337}"                       # Strapi listens on 127.0.0.1 only; Caddy is the only way in
: "${HEAP_MB:=320}"                     # Node old-space cap measured in S0b
: "${LOCALE:=vi}"
: "${DOMAIN:=}"                         # required by the Caddy step; sslip.io name from the static IP by default (one-off script)
: "${ACME_EMAIL:=}"                     # optional: Let's Encrypt expiry notices
: "${ADMIN_EMAIL:=}"                    # required by the admin step
: "${ADMIN_FIRSTNAME:=Site}"
: "${ADMIN_LASTNAME:=Admin}"
: "${SSH_USER:=ubuntu}"
: "${HEALTH_WAIT_SECONDS:=300}"
: "${DRY_RUN:=0}"                       # 1 = print what would change, change nothing (works on a Mac)

SECRET_KEYS="APP_KEYS API_TOKEN_SALT ADMIN_JWT_SECRET TRANSFER_TOKEN_SALT JWT_SECRET ENCRYPTION_KEY"

say() { printf '== %s\n' "$*"; }
refuse() { say "refused: $*"; exit 2; }

# run CMD...: execute, or only print under DRY_RUN=1
run() {
  if [ "$DRY_RUN" = 1 ]; then printf '== would run: %s\n' "$*"; return 0; fi
  "$@"
}

# write_file PATH MODE OWNER:GROUP  (content on stdin)
write_file() {
  local path=$1 mode=$2 owner=$3
  if [ "$DRY_RUN" = 1 ]; then printf '== would write %s (mode %s, owner %s):\n' "$path" "$mode" "$owner"; sed 's/^/   | /'; return 0; fi
  local tmp; tmp=$(mktemp "$path.XXXXXX") || return 1
  cat > "$tmp" && chmod "$mode" "$tmp" && chown "$owner" "$tmp" && mv "$tmp" "$path"
}

need_root_linux() {
  [ "$DRY_RUN" = 1 ] && return 0
  [ "$(uname -s)" = Linux ] || refuse "this step runs on the Linux box, not here. Use DRY_RUN=1 to see what it would do."
  [ "$(id -u)" = 0 ] || refuse "this step must run as root (sudo)."
}

# ---------- renderers: pure text, no side effects, tested by selftest.sh ----------

render_unit() {
  cat <<UNIT
# Written by ops/box/60-service.sh. NOT RUN ANYWHERE until the first real box run.
[Unit]
Description=Strapi CMS ($SERVICE_NAME)
After=network.target

[Service]
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=$HEAP_MB
Environment=PATH=$NODE_DIR/bin:/usr/bin:/bin
# The shim run as a program, NOT through node: in a pnpm tree node_modules/.bin/strapi is a shell script
# (S0b: 132 crash restarts on 'node node_modules/.bin/strapi'). The shim finds node on PATH above.
ExecStart=$APP_DIR/node_modules/.bin/strapi start
Restart=always
RestartSec=2
MemoryAccounting=yes
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes

[Install]
WantedBy=multi-user.target
UNIT
}

render_caddyfile() {
  [ -n "$DOMAIN" ] || return 1
  if [ -n "$ACME_EMAIL" ]; then printf '{\n\temail %s\n}\n\n' "$ACME_EMAIL"; fi
  cat <<CADDY
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:$PORT
}
CADDY
}

# the non-secret lines of the box's environment file; secrets are added by gen-env.js
render_env_params() {
  cat <<ENVP
HOST=127.0.0.1
PORT=$PORT
NODE_ENV=production
PROXY=true
PUBLIC_URL=${DOMAIN:+https://$DOMAIN}
DATABASE_FILENAME=$DATABASE_FILE
STRAPI_PLUGIN_I18N_INIT_LOCALE_CODE=$LOCALE
STRAPI_TELEMETRY_DISABLED=true
ENVP
}

render_sshd_dropin() {
  cat <<SSHD
# Written by ops/box/90-ssh.sh. Keys only, no root login. Which addresses may connect is the Lightsail firewall's job.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
SSHD
}

# ---------- backup (piece P7). NOT RUN ANYWHERE against a real box. ----------
: "${BACKUP_DIR:=/var/backups/strapi}"   # on the box's own disk: it does NOT survive the box (see docs/conventions/publish.md)
: "${UPLOADS_DIR:=$APP_DIR/public/uploads}"
: "${BACKUP_KEEP:=14}"                   # how many daily database sets are kept; older ones are deleted AFTER a new one is verified
: "${BACKUP_MIN_FREE_MB:=500}"           # refuse to start with less free than this (and less than 3x what is being copied)
: "${BACKUP_TIME:=03:30}"                # box local time (UTC on Lightsail Ubuntu); the timer is Persistent, so a missed run happens at next boot
: "${OFFBOX_CMD:=}"                      # optional: a command run with the finished set's folder as $1, e.g. an upload. Empty = none.
: "${BACKUP_BIN:=/usr/local/sbin/strapi-backup}"

render_backup_service() {
  cat <<UNIT
# Written by ops/box/95-backup.sh. NOT RUN ANYWHERE until the first real box run.
[Unit]
Description=Nightly backup of the Strapi database and uploads ($SERVICE_NAME)

[Service]
Type=oneshot
Environment=DATABASE_FILE=$DATABASE_FILE UPLOADS_DIR=$UPLOADS_DIR BACKUP_DIR=$BACKUP_DIR BACKUP_KEEP=$BACKUP_KEEP BACKUP_MIN_FREE_MB=$BACKUP_MIN_FREE_MB
ExecStart=$BACKUP_BIN
# Low priority: the box has 512 MB and one CPU share, and Strapi must stay responsive during the copy.
Nice=15
IOSchedulingClass=idle
TimeoutStartSec=30min
UNIT
}

render_backup_timer() {
  cat <<TIMER
# Written by ops/box/95-backup.sh. NOT RUN ANYWHERE until the first real box run.
[Unit]
Description=Nightly Strapi backup at $BACKUP_TIME

[Timer]
OnCalendar=*-*-* $BACKUP_TIME:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
TIMER
}
