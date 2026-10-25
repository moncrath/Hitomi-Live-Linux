import QtQuick
import QtQuick.Layouts
import org.kde.plasma.components as PC3
import org.kde.kirigami as Kirigami

// Pemakaian jendela konteks satu sesi: nama, "terpakai / jendela · persen", dan bar.
ColumnLayout {
    id: row

    property string title
    property real used: -1          // token; -1 = transkrip tak terbaca
    property real window: 1000000
    readonly property bool known: used >= 0
    readonly property int pct: known && window > 0 ? Math.round(used * 100 / window) : 0

    function tokens(n) {
        var dp = Qt.locale().decimalPoint
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".", dp).replace(dp + "0", "") + "M"
        return (n / 1000).toFixed(1).replace(".", dp) + "k"
    }

    spacing: Kirigami.Units.smallSpacing
    Layout.fillWidth: true
    Accessible.role: Accessible.ListItem
    Accessible.name: title + ", " + (known ? "konteks terpakai " + pct + " persen" : "konteks tidak terbaca")

    RowLayout {
        Layout.fillWidth: true
        PC3.Label {
            Layout.fillWidth: true
            text: row.title
            elide: Text.ElideRight
        }
        PC3.Label {
            text: row.known ? row.tokens(row.used) + " / " + row.tokens(row.window) + " · " + row.pct + "%" : "tidak terbaca"
            font: Kirigami.Theme.smallFont
            opacity: 0.85
        }
    }
    Rectangle {
        Layout.fillWidth: true
        implicitHeight: 6
        radius: 3
        color: Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.14)

        Rectangle {
            width: row.known ? parent.width * Math.min(row.pct, 100) / 100 : 0
            height: parent.height
            radius: 3
            // Oranye dari 80%, merah dari 95%: status nyata, bukan hiasan.
            color: row.pct >= 95 ? Kirigami.Theme.negativeTextColor
                 : row.pct >= 80 ? Kirigami.Theme.neutralTextColor
                 : Kirigami.Theme.focusColor

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
