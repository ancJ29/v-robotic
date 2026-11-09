#!/usr/bin/env bash
# Step 30: the system account Strapi runs as, and the folders with their owners.
# Code is root-owned and read-only to Strapi; only the data folder and the upload/cache folders are its own.
# NOT RUN ANYWHERE against a real box. Open point: whether Strapi writes anywhere else under APP_DIR is
# unverified; if the first start fails on a permission, journalctl names the path (docs/conventions/box.md).
set -euo pipefail
. "$(dirname "$0")/params.sh"
need_root_linux
say "account $SERVICE_USER (no login, no shell), folders $DATA_DIR and $ENV_DIR"
if [ "$DRY_RUN" = 1 ] || ! id "$SERVICE_USER" >/dev/null 2>&1; then
  run useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi
run install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 750 "$DATA_DIR"
run install -d -o root -g root -m 700 "$ENV_DIR"
run install -d -o root -g root -m 755 "$(dirname "$APP_DIR")"
