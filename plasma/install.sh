#!/bin/sh
# Pasang atau lepas Hitomi Hub (opsional), plasmoid KDE Plasma 6 di folder ini.
# Hanya menulis ke ~/.local; tak butuh sudo dan tak menyentuh konfigurasi panel.
#
#   ./install.sh              pasang dengan ikon roda gigi
#   ./install.sh --avatar     pasang dengan ikon avatar (gambar buatan ChatGPT, lihat
#                             hitomi-hub/contents/icons/avatar/LICENSE)
#   ./install.sh --uninstall  lepas
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
ID=dev.hitomi.hub
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA/plasma/plasmoids/$ID"
ICONS="$DATA/icons/hicolor"
SIZES="22 32 48 64 128 256"

remove_gear() { rm -f "$ICONS/scalable/apps/hitomi-hub.svg"; }
remove_avatar() { for s in $SIZES; do rm -f "$ICONS/${s}x${s}/apps/hitomi-hub.png"; done; }

AVATAR=0
case "${1:-}" in
  --uninstall)
    rm -rf "${DEST:?}"
    remove_gear
    remove_avatar
    echo "Hitomi Hub dilepas. Hapus juga widget-nya dari panel lewat Edit Mode."
    exit 0 ;;
  --avatar) AVATAR=1 ;;
  '') ;;
  *) echo "Pemakaian: $0 [--avatar | --uninstall]" >&2; exit 2 ;;
esac

command -v plasmashell >/dev/null 2>&1 || { echo "plasmashell tak ditemukan: Hitomi Hub butuh KDE Plasma 6." >&2; exit 1; }
for tool in python3 wpctl nmcli bluetoothctl qdbus6; do
  command -v "$tool" >/dev/null 2>&1 || echo "Catatan: '$tool' tak ditemukan; bagian yang memakainya akan kosong."
done

mkdir -p "$DEST"
cp -r "$HERE/hitomi-hub/." "$DEST/"
chmod +x "$DEST/contents/code/"*.sh "$DEST/contents/code/hub.py"

# Satu jenis ikon saja yang dipasang, supaya nama `hitomi-hub` tak ambigu.
if [ "$AVATAR" = 1 ]; then
  remove_gear
  for s in $SIZES; do
    mkdir -p "$ICONS/${s}x${s}/apps"
    cp "$HERE/hitomi-hub/contents/icons/avatar/$s.png" "$ICONS/${s}x${s}/apps/hitomi-hub.png"
  done
  echo "Ikon: avatar"
else
  remove_avatar
  mkdir -p "$ICONS/scalable/apps"
  cp "$HERE/hitomi-hub/contents/icons/hitomi-hub.svg" "$ICONS/scalable/apps/hitomi-hub.svg"
  echo "Ikon: roda gigi"
fi

echo "Terpasang di $DEST"
echo "Berikutnya: klik kanan panel > Enter Edit Mode > Add Widgets > cari 'Hitomi Hub'."
echo "Ikon di panel berganti setelah Plasma dimuat ulang. Uji tanpa panel: plasmawindowed $ID"
