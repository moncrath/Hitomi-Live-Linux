import QtQuick
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami

// Bar tebal yang bisa digeser; fokus keyboard (panah kiri/kanan) dan pembaca layar dari QQC2.Slider.
QQC2.Slider {
    id: control

    property int fillMs: 240
    property bool unavailable: false

    from: 0
    to: 100
    stepSize: 1
    enabled: !unavailable
    implicitHeight: Kirigami.Units.gridUnit * 1.6
    hoverEnabled: true

    handle: Item {}

    background: Rectangle {
        radius: Kirigami.Units.smallSpacing * 2
        color: Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.12)
        border.width: control.visualFocus ? 2 : 0
        border.color: Kirigami.Theme.focusColor

        Rectangle {
            width: control.visualPosition * parent.width
            height: parent.height
            radius: parent.radius
            color: control.unavailable ? Kirigami.Theme.disabledTextColor : Kirigami.Theme.focusColor

            // Saat digeser, bar mengikuti jari tanpa jeda; animasi hanya untuk perubahan dari luar.
            Behavior on width {
                enabled: !control.pressed && Kirigami.Units.longDuration > 0
                NumberAnimation {
                    duration: control.fillMs
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: [0.2, 0.8, 0.2, 1, 1, 1]
                }
            }
        }
    }
}
