# Hitomi Hub

Plasmoid KDE Plasma 6 untuk kontrol cepat dan status sistem. Dibuka dari ikon di panel.

Isi, dari atas: cahaya monitor, volume, Wi-Fi, Bluetooth, kecepatan jaringan, monitor RAM/GPU/CPU,
lalu tab Working (sesi Claude Code yang berjalan beserta konteks terpakai), Services, dan CI.

## Sumber data (semua lokal, tanpa jaringan kecuali `gh` untuk tab CI)

| Bagian | Perintah |
|---|---|
| Cahaya | D-Bus `org.kde.ScreenBrightness` (monitor harus mendukung DDC/CI) |
| Suara | `wpctl` |
| Wi-Fi / Bluetooth | `nmcli radio wifi`, `bluetoothctl power` |
| RAM / CPU / jaringan | `/proc` (lihat `contents/code/poll.sh`) |
| GPU | `nvidia-smi` |
| Working / CI | `contents/code/hub.py`: `~/.claude/sessions/*.json` dan `gh run list` |
| Context | `hub.py context`: token dari pesan asisten terakhir di transkrip `~/.claude/projects/<folder>/<sesi>.jsonl` (input + cache baca + cache tulis). Jendela dianggap 1M; rincian per kategori tidak ada di transkrip |
| Services | `systemctl is-active` (hanya membaca) |

Tab Services hanya membaca. Nilai slider diubah dengan batas: cahaya minimal 5%, suara 0 sampai 100%.

## Warna

Semua warna diambil dari tema KDE, jadi ikut berubah saat wallpaper (dan aksen dari wallpaper) diganti.
Teks diganti ke terang/gelap bila skema warna KDE memberi kontras di bawah 4,5:1.

## Uji tanpa memasang ke panel

```bash
plasmawindowed dev.hitomi.hub
```
