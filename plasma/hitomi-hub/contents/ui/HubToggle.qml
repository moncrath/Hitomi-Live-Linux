import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.plasma.components as PC3
import org.kde.kirigami as Kirigami

// Tombol nyala/mati. Status dibaca dari teks ("nyala"/"mati") dan warna, tak hanya warna.
QQC2.AbstractButton {
    id: btn

    property bool on: false

    implicitHeight: Kirigami.Units.gridUnit * 2.6
    hoverEnabled: true
    scale: down ? 0.97 : 1
    Behavior on scale { NumberAnimation { duration: Kirigami.Units.longDuration > 0 ? 90 : 0; easing.type: Easing.OutCubic } }

    Accessible.role: Accessible.CheckBox
    Accessible.checkable: true
    Accessible.checked: on
    Accessible.name: text
    Accessible.onPressAction: clicked()

    background: Rectangle {
        radius: Kirigami.Units.smallSpacing * 2
        color: btn.on
            ? Qt.rgba(Kirigami.Theme.focusColor.r, Kirigami.Theme.focusColor.g, Kirigami.Theme.focusColor.b, btn.hovered ? 0.32 : 0.24)
            : Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, btn.hovered ? 0.10 : 0.06)
        border.width: btn.visualFocus ? 2 : 1
        border.color: btn.visualFocus ? Kirigami.Theme.focusColor
            : btn.on ? Kirigami.Theme.focusColor
            : Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.12)
    }

    contentItem: ColumnLayout {
        spacing: 0
        PC3.Label {
            Layout.alignment: Qt.AlignHCenter
            text: btn.text
            font.bold: btn.on
        }
        PC3.Label {
            Layout.alignment: Qt.AlignHCenter
            text: btn.on ? "nyala" : "mati"
            font: Kirigami.Theme.smallFont
            opacity: 0.85
        }
    }
}
