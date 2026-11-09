#!/usr/bin/env bash
# Step 40: unpack the artifact (no install: it is a finished production tree), keep one previous copy,
# set permissions, restart the service if it exists. Run again with a new TARBALL to deploy.
# NOT RUN ANYWHERE against a real box.
set -euo pipefail
. "$(dirname "$0")/params.sh"
need_root_linux
# Re-runnable: after a failure in a later step the tarball is gone but the app is in place, so skip.
if [ "$DRY_RUN" != 1 ] && [ ! -f "$TARBALL" ] && [ -f "$APP_DIR/node_modules/.bin/strapi" ]; then
  say "no artifact at $TARBALL but the app is already unpacked in $APP_DIR: step skipped (upload a new tarball to deploy a new version)"
  exit 0
fi
[ "$DRY_RUN" = 1 ] || [ -f "$TARBALL" ] || refuse "no artifact at $TARBALL"
say "unpacking $TARBALL into $APP_DIR (previous copy kept as $APP_DIR.prev)"
if [ "$DRY_RUN" = 1 ]; then
  say "would unpack to $APP_DIR.new, check node_modules/.bin/strapi, stop the service, swap folders, fix owners, start"; exit 0
fi
rm -rf "$APP_DIR.new"; mkdir -p "$APP_DIR.new"
tar -xzf "$TARBALL" -C "$APP_DIR.new" --no-same-owner
if [ ! -f "$APP_DIR.new/package.json" ]; then   # tolerate one wrapping folder
  sub=$(ls -d "$APP_DIR.new"/*/ | head -n 1); shopt -s dotglob; mv "$sub"* "$APP_DIR.new"/; rmdir "$sub"
fi
[ -f "$APP_DIR.new/node_modules/.bin/strapi" ] || { rm -rf "$APP_DIR.new"; refuse "the artifact has no node_modules/.bin/strapi"; }
if find "$APP_DIR.new" -maxdepth 1 -name '.env*' ! -name '.env.example' | grep -q .; then
  rm -rf "$APP_DIR.new"; refuse "the artifact holds an .env file; keys come from $ENV_FILE only"
fi
chown -R root:root "$APP_DIR.new"; chmod -R a+rX,go-w "$APP_DIR.new"
# .strapi is left out of the artifact; Strapi may recreate it on start, and must be able to as user strapi
for d in public/uploads .tmp .cache .strapi; do install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 750 "$APP_DIR.new/$d"; done
chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR.new/public"   # Strapi may create files directly in public/
had=0; systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null && had=1
[ "$had" = 1 ] && systemctl stop "$SERVICE_NAME"
rm -rf "$APP_DIR.prev"; [ -d "$APP_DIR" ] && mv "$APP_DIR" "$APP_DIR.prev"
mv "$APP_DIR.new" "$APP_DIR"
[ "$had" = 1 ] && systemctl start "$SERVICE_NAME"
rm -f "$TARBALL"
sed -n 1,12p "$APP_DIR/BUILD-INFO.txt" 2>/dev/null || true
df -h / | tail -1
