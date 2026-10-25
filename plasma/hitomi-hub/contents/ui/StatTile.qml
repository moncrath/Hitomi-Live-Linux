import QtQuick
import QtQuick.Layouts
import org.kde.plasma.components as PC3
import org.kde.kirigami as Kirigami

Rectangle {
    id: tile

    property string label
    property int value: -1          // persen; -1 = tak terbaca
    readonly property bool known: value >= 0

    radius: Kirigami.Units.smallSpacing * 2
    color: Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.06)
    border.width: 1
    border.color: Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.12)
    implicitHeight: col.implicitHeight + Kirigami.Units.smallSpacing * 4

    Accessible.role: Accessible.StaticText
    Accessible.name: label + " " + (known ? value + " persen" : "tidak terbaca")

    ColumnLayout {
        id: col
        anchors.fill: parent
        anchors.margins: Kirigami.Units.smallSpacing * 2
        spacing: Kirigami.Units.smallSpacing

        PC3.Label {
            text: tile.label
            font: Kirigami.Theme.smallFont
            opacity: 0.8
        }
        PC3.Label {
            text: tile.known ? tile.value + "%" : "-"
            font.family: Kirigami.Theme.fixedWidthFont.family
            font.pointSize: Kirigami.Theme.defaultFont.pointSize * 1.25
            font.bold: true
        }
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: 4
            radius: 2
            color: Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.14)

            Rectangle {
                width: tile.known ? parent.width * Math.min(tile.value, 100) / 100 : 0
                height: parent.height
                radius: 2
                // Oranye hanya untuk status nyata: beban 90% ke atas.
                color: tile.value >= 90 ? Kirigami.Theme.neutralTextColor : Kirigami.Theme.focusColor

                Behavior on width {
                    enabled: Kirigami.Units.longDuration > 0
                    NumberAnimation {
                        duration: 240
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: [0.2, 0.8, 0.2, 1, 1, 1]
                    }
                }
            }
        }
    }
}
