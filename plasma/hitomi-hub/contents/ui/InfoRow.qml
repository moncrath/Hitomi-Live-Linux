import QtQuick
import QtQuick.Layouts
import org.kde.plasma.components as PC3
import org.kde.kirigami as Kirigami

// Satu baris status: titik berwarna + nama + keterangan. Warna selalu dipasangkan dengan teks.
RowLayout {
    id: row

    property string title
    property string detail
    property color dotColor: Kirigami.Theme.disabledTextColor

    spacing: Kirigami.Units.smallSpacing * 2
    Layout.fillWidth: true

    Accessible.role: Accessible.ListItem
    Accessible.name: title + ", " + detail

    Rectangle {
        implicitWidth: 8
        implicitHeight: 8
        radius: 4
        color: row.dotColor
    }
    PC3.Label {
        Layout.fillWidth: true
        text: row.title
        elide: Text.ElideRight
    }
    PC3.Label {
        text: row.detail
        font: Kirigami.Theme.smallFont
        opacity: 0.85
    }
}
