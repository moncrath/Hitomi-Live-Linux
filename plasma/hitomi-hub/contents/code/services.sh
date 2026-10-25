#!/bin/sh
# Status layanan dari services.txt: satu nama unit per baris, baris berawalan # diabaikan.
# Hanya membaca; tidak ada start, stop, atau restart.
while read -r unit; do
  case "$unit" in ''|'#'*) continue ;; esac
  printf '%s %s\n' "$unit" "$(systemctl is-active "$unit" 2>/dev/null)"
done < "$(dirname "$0")/services.txt"
