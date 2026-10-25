#!/bin/sh
# Pasang atau lepas Hitomi Hub (opsional), plasmoid KDE Plasma 6 di folder ini.
# Hanya menulis ke ~/.local; tak butuh sudo dan tak menyentuh konfigurasi panel.
#
#   ./install.sh              pasang
#   ./install.sh --uninstall  lepas
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
ID=dev.hitomi.hub
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/plasma/plasmoids/$ID"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/scalable/apps"

if [ "${1:-}" = "--uninstall" ]; then
  rm -rf "${DEST:?}"
  rm -f "$ICON_DIR/hitomi-hub.svg"
  echo "Hitomi Hub dilepas. Hapus juga widget-nya dari panel lewat Edit Mode."
  exit 0
fi

command -v plasmashell >/dev/null 2>&1 || { echo "plasmashell tak ditemukan: Hitomi Hub butuh KDE Plasma 6." >&2; exit 1; }
for tool in python3 wpctl nmcli bluetoothctl qdbus6; do
  command -v "$tool" >/dev/null 2>&1 || echo "Catatan: '$tool' tak ditemukan; bagian yang memakainya akan kosong."
done

mkdir -p "$DEST" "$ICON_DIR"
cp -r "$HERE/hitomi-hub/." "$DEST/"
chmod +x "$DEST/contents/code/"*.sh "$DEST/contents/code/hub.py"
cp "$HERE/hitomi-hub/contents/icons/hitomi-hub.svg" "$ICON_DIR/hitomi-hub.svg"

echo "Terpasang di $DEST"
echo "Berikutnya: klik kanan panel > Enter Edit Mode > Add Widgets > cari 'Hitomi Hub'."
echo "Uji tanpa panel: plasmawindowed $ID"
