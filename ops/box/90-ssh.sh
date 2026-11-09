#!/usr/bin/env bash
# Step 90: ssh by key only, no root login. Which addresses may connect is the Lightsail firewall's job.
# Validates with sshd -t before reloading; the open session survives a reload. NOT RUN ANYWHERE against a real box.
set -euo pipefail
. "$(dirname "$0")/params.sh"
need_root_linux
render_sshd_dropin | write_file /etc/ssh/sshd_config.d/10-box.conf 644 root:root
[ "$DRY_RUN" = 1 ] && exit 0
sshd -t || { rm -f /etc/ssh/sshd_config.d/10-box.conf; refuse "sshd rejected the config; the drop-in was removed"; }
# on Ubuntu 24.04 sshd may be socket-activated; reload of an inactive ssh.service fails, so fall back
systemctl reload ssh || systemctl try-restart ssh.socket || true
