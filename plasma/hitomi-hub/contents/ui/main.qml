import QtQuick
import org.kde.plasma.plasmoid

PlasmoidItem {
    id: root

    // Roda gigi satu warna di ~/.local/share/icons/hicolor/scalable/apps/hitomi-hub.svg;
    // mengikuti warna teks tema lewat kelas ColorScheme-Text.
    Plasmoid.icon: "hitomi-hub"
    toolTipMainText: "Hitomi Hub"
    toolTipSubText: "Kontrol cepat dan status sistem"

    // Pembacaan data hanya berjalan saat panel terbuka.
    fullRepresentation: Hub {
        active: root.expanded
    }
}
