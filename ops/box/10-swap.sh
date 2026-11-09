#!/usr/bin/env bash
# Step 10: the swap file, kept across reboots, and swappiness. S0b's "512 MB is enough" holds only with this.
# NOT RUN ANYWHERE against a real box (commands lifted from S0b, which did run them).
set -euo pipefail
. "$(dirname "$0")/params.sh"
need_root_linux
say "swap: ${SWAP_GB} GB at $SWAP_FILE, swappiness $SWAPPINESS"
if [ "$DRY_RUN" != 1 ] && swapon --show --noheadings | grep -q .; then
  say "swap already active, left as is"
else
  run fallocate -l "${SWAP_GB}G" "$SWAP_FILE"
  run chmod 600 "$SWAP_FILE"
  run mkswap "$SWAP_FILE"
  run swapon "$SWAP_FILE"
fi
if [ "$DRY_RUN" = 1 ]; then say "would add '$SWAP_FILE none swap sw 0 0' to /etc/fstab if missing"
elif ! grep -q "^$SWAP_FILE " /etc/fstab; then printf '%s none swap sw 0 0\n' "$SWAP_FILE" >> /etc/fstab; fi
printf 'vm.swappiness=%s\n' "$SWAPPINESS" | write_file /etc/sysctl.d/99-swappiness.conf 644 root:root
run sysctl -q -p /etc/sysctl.d/99-swappiness.conf
