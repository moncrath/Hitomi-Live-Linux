import QtQuick
import QtQuick.Layouts
import org.kde.plasma.components as PC3
import org.kde.plasma.plasma5support as P5Support
import org.kde.kirigami as Kirigami

Item {
    id: hub

    property bool active: false

    // Urutan dan isi panel mengikuti thesis: cahaya, suara, Wi-Fi/Bluetooth/jaringan,
    // monitor RAM/GPU/CPU, lalu tab Working/Services/CI.
    readonly property string codeDir: Qt.resolvedUrl("../code/").toString().replace("file://", "")
    readonly property int tabMs: Kirigami.Units.longDuration > 0 ? 140 : 0

    // Hasil pembacaan terakhir. -1 = tak terbaca.
    property int cpu: -1
    property int ram: -1
    property int gpu: -1
    property real rx: 0
    property real tx: 0
    property bool wifiOn: false
    property bool btOn: false
    property int volPct: -1
    property int briPct: -1
    property bool polled: false

    property var ci: null
    property var svc: null
    property var ctx: null
    property string tabError: ""
    property double lastCi: 0
    // Sesudah user menggeser slider, hasil pembacaan diabaikan sebentar supaya slider tak melompat.
    property double holdUntil: 0

    Layout.preferredWidth: Kirigami.Units.gridUnit * 23
    Layout.minimumWidth: Layout.preferredWidth
    implicitWidth: Layout.preferredWidth
    implicitHeight: content.implicitHeight + Kirigami.Units.largeSpacing * 2

    function dur(ms) { return Kirigami.Units.longDuration > 0 ? ms : 0 }

    // Warna teks dari skema KDE dipakai bila kontrasnya cukup (WCAG AA 4,5:1). Skema pihak
    // ketiga kadang terlalu redup (Sweet-Mars: 3,6:1), jadi diganti terang/gelap bila kurang.
    function lum(c) {
        function f(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    function ratio(a, b) {
        var l1 = Math.max(lum(a), lum(b)), l2 = Math.min(lum(a), lum(b))
        return (l1 + 0.05) / (l2 + 0.05)
    }
    readonly property color ink: ratio(Kirigami.Theme.textColor, Kirigami.Theme.backgroundColor) >= 4.5
        ? Kirigami.Theme.textColor
        : (lum(Kirigami.Theme.backgroundColor) < 0.4 ? "#E6EAEC" : "#1B1E20")

    function rate(b) {
        var dp = Qt.locale().decimalPoint
        if (b >= 1048576) return (b / 1048576).toFixed(1).replace(".", dp) + " MB/s"
        if (b >= 1024) return Math.round(b / 1024) + " KB/s"
        return Math.max(0, Math.round(b)) + " B/s"
    }

    // ---- menjalankan perintah ----
    P5Support.DataSource {
        id: sh
        engine: "executable"
        connectedSources: []
        property var handlers: ({})
        onNewData: (source, data) => {
            disconnectSource(source)
            var cb = handlers[source]
            delete handlers[source]
            if (cb) cb(data["exit code"], data["stdout"] || "")
        }
        function run(cmd, cb) {
            handlers[cmd] = cb || null
            connectSource(cmd)
        }
    }

    function poll() {
        sh.run("sh '" + codeDir + "poll.sh'", function (code, out) {
            var m = {}
            out.split("\n").forEach(function (l) {
                var i = l.indexOf("=")
                if (i > 0) m[l.slice(0, i)] = l.slice(i + 1).trim()
            })
            var num = function (k) { return m[k] !== undefined && m[k] !== "" && !isNaN(m[k]) ? Number(m[k]) : -1 }
            hub.cpu = num("cpu"); hub.ram = num("ram"); hub.gpu = num("gpu")
            hub.rx = Math.max(0, num("rx")); hub.tx = Math.max(0, num("tx"))
            hub.wifiOn = m["wifi"] === "enabled"
            hub.btOn = m["bt"] === "yes"
            if (Date.now() > hub.holdUntil) {
                var v = num("vol"); hub.volPct = v < 0 ? -1 : Math.round(v * 100)
                var b = num("bri"); hub.briPct = b < 0 ? -1 : Math.round(b / 100)
            }
            hub.polled = true
        })
    }

    function refreshTab() {
        tabError = ""
        var t = tabs.currentIndex
        if (t === 0) {
            sh.run("python3 -I '" + codeDir + "hub.py' context", function (c, out) { hub.ctx = parse(out) })
        } else if (t === 1) {
            // Daftar layanan ada di contents/code/services.txt.
            sh.run("sh '" + codeDir + "services.sh'", function (c, out) {
                hub.svc = out.trim().split("\n").filter(function (l) { return l.length > 0 }).map(function (l) {
                    var i = l.lastIndexOf(" ")
                    return { name: l.slice(0, i), state: l.slice(i + 1) || "unknown" }
                })
            })
        } else if (t === 2 && (Date.now() - lastCi > 60000 || ci === null)) {
            lastCi = Date.now()
            sh.run("python3 -I '" + codeDir + "hub.py' ci", function (c, out) { hub.ci = parse(out) })
        }
    }

    function parse(out) {
        try { return JSON.parse(out) } catch (e) { tabError = "Data tidak terbaca."; return [] }
    }

    // ---- kontrol ----
    function setBrightness(pct) {
        holdUntil = Date.now() + 1500
        var raw = Math.round(Math.max(5, Math.min(100, pct)) * 100)   // minimal 5% supaya layar tak gelap total
        sh.run("qdbus6 org.kde.ScreenBrightness /org/kde/ScreenBrightness/display0 org.kde.ScreenBrightness.Display.SetBrightness " + raw + " 0")
    }
    function setVolume(pct) {
        holdUntil = Date.now() + 1500
        var v = (Math.max(0, Math.min(100, Math.round(pct))) / 100).toFixed(2)
        sh.run("wpctl set-volume @DEFAULT_AUDIO_SINK@ " + v)
    }
    function toggleWifi() {
        wifiOn = !wifiOn
        sh.run("nmcli radio wifi " + (wifiOn ? "on" : "off"), function () { poll() })
    }
    function toggleBt() {
        btOn = !btOn
        sh.run("bluetoothctl power " + (btOn ? "on" : "off"), function () { poll() })
    }

    Timer { id: briDebounce; interval: 120; property real pending: 0; onTriggered: hub.setBrightness(pending) }
    Timer { id: volDebounce; interval: 120; property real pending: 0; onTriggered: hub.setVolume(pending) }

    Timer {
        interval: 2000
        repeat: true
        running: hub.active
        triggeredOnStart: true
        onTriggered: hub.poll()
    }
    Timer {
        interval: 5000
        repeat: true
        running: hub.active
        onTriggered: hub.refreshTab()
    }
    onActiveChanged: if (active) { enter.restart(); refreshTab() }

    // Isi panel naik 8 px sambil muncul; bingkai popup diurus Plasma. Mati bila animasi KDE dimatikan.
    ParallelAnimation {
        id: enter
        NumberAnimation {
            target: content; property: "opacity"; from: 0; to: 1; duration: hub.dur(180)
            easing.type: Easing.BezierSpline; easing.bezierCurve: [0.2, 0.8, 0.2, 1, 1, 1]
        }
        NumberAnimation {
            target: shift; property: "y"; from: 8; to: 0; duration: hub.dur(180)
            easing.type: Easing.BezierSpline; easing.bezierCurve: [0.2, 0.8, 0.2, 1, 1, 1]
        }
    }

    ColumnLayout {
        id: content
        anchors.fill: parent
        anchors.margins: Kirigami.Units.largeSpacing
        spacing: Kirigami.Units.largeSpacing
        transform: Translate { id: shift }

        Kirigami.Theme.inherit: false
        Kirigami.Theme.colorSet: Kirigami.Theme.Window
        Kirigami.Theme.textColor: hub.ink

        PC3.Label {
            text: "Hitomi Hub"
            font.bold: true
            font.pointSize: Kirigami.Theme.defaultFont.pointSize * 1.15
            Accessible.role: Accessible.Heading
        }

        // Cahaya
        RowLayout {
            spacing: Kirigami.Units.largeSpacing
            PC3.Label { text: "Cahaya"; Layout.preferredWidth: Kirigami.Units.gridUnit * 3 }
            HubSlider {
                id: briSlider
                Layout.fillWidth: true
                unavailable: hub.briPct < 0
                Accessible.name: "Kecerahan monitor"
                value: hub.briPct < 0 ? 0 : hub.briPct
                onMoved: { briDebounce.pending = value; briDebounce.restart(); hub.holdUntil = Date.now() + 1500 }
            }
            PC3.Label {
                text: hub.briPct < 0 ? "-" : Math.round(briSlider.value) + "%"
                horizontalAlignment: Text.AlignRight
                Layout.preferredWidth: Kirigami.Units.gridUnit * 2.5
                font.family: Kirigami.Theme.fixedWidthFont.family
            }
        }
        PC3.Label {
            visible: hub.polled && hub.briPct < 0
            text: "Monitor ini tidak mendukung pengaturan cahaya lewat kabel (DDC/CI)."
            font: Kirigami.Theme.smallFont
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            opacity: 0.85
        }

        // Suara
        RowLayout {
            spacing: Kirigami.Units.largeSpacing
            PC3.Label { text: "Suara"; Layout.preferredWidth: Kirigami.Units.gridUnit * 3 }
            HubSlider {
                id: volSlider
                Layout.fillWidth: true
                unavailable: hub.volPct < 0
                Accessible.name: "Volume keluaran suara"
                value: hub.volPct < 0 ? 0 : hub.volPct
                onMoved: { volDebounce.pending = value; volDebounce.restart(); hub.holdUntil = Date.now() + 1500 }
            }
            PC3.Label {
                text: hub.volPct < 0 ? "-" : Math.round(volSlider.value) + "%"
                horizontalAlignment: Text.AlignRight
                Layout.preferredWidth: Kirigami.Units.gridUnit * 2.5
                font.family: Kirigami.Theme.fixedWidthFont.family
            }
        }

        // Wi-Fi, Bluetooth, jaringan
        RowLayout {
            spacing: Kirigami.Units.smallSpacing * 2
            Layout.fillWidth: true
            uniformCellSizes: true

            HubToggle {
                Layout.fillWidth: true
                text: "Wi-Fi"
                on: hub.wifiOn
                onClicked: hub.toggleWifi()
            }
            HubToggle {
                Layout.fillWidth: true
                text: "Bluetooth"
                on: hub.btOn
                onClicked: hub.toggleBt()
            }
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: netCol.implicitHeight + Kirigami.Units.smallSpacing * 3
                radius: Kirigami.Units.smallSpacing * 2
                color: Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.06)
                border.width: 1
                border.color: Qt.rgba(Kirigami.Theme.textColor.r, Kirigami.Theme.textColor.g, Kirigami.Theme.textColor.b, 0.12)
                Accessible.role: Accessible.StaticText
                Accessible.name: "Kecepatan jaringan, unduh " + hub.rate(hub.rx) + ", unggah " + hub.rate(hub.tx)

                ColumnLayout {
                    id: netCol
                    anchors.centerIn: parent
                    spacing: 0
                    PC3.Label { text: "↓ " + hub.rate(hub.rx); font: Kirigami.Theme.smallFont }
                    PC3.Label { text: "↑ " + hub.rate(hub.tx); font: Kirigami.Theme.smallFont }
                }
            }
        }

        // RAM, GPU, CPU
        RowLayout {
            spacing: Kirigami.Units.smallSpacing * 2
            Layout.fillWidth: true
            uniformCellSizes: true
            StatTile { Layout.fillWidth: true; label: "RAM"; value: hub.ram }
            StatTile { Layout.fillWidth: true; label: "GPU"; value: hub.gpu }
            StatTile { Layout.fillWidth: true; label: "CPU"; value: hub.cpu }
        }

        // Tab
        PC3.TabBar {
            id: tabs
            Layout.fillWidth: true
            onCurrentIndexChanged: hub.refreshTab()
            PC3.TabButton { text: "Working" }
            PC3.TabButton { text: "Services" }
            PC3.TabButton { text: "CI" }
        }

        Item {
            id: panes
            Layout.fillWidth: true
            Layout.preferredHeight: Kirigami.Units.gridUnit * 9
            clip: true

            // Satu pane per tab; muncul dengan fade 140 ms.
            Repeater {
                model: 3
                delegate: ColumnLayout {
                    id: pane
                    required property int index
                    anchors.fill: parent
                    visible: tabs.currentIndex === index
                    spacing: Kirigami.Units.smallSpacing * 2
                    onVisibleChanged: if (visible) fade.restart()
                    NumberAnimation { id: fade; target: pane; property: "opacity"; from: 0; to: 1; duration: hub.tabMs }

                    // Working: sesi Claude Code yang berjalan beserta konteks terpakai
                    PC3.Label {
                        visible: pane.index === 0 && hub.ctx === null
                        text: "Membaca sesi…"
                        opacity: 0.8
                    }
                    PC3.Label {
                        visible: pane.index === 0 && hub.ctx !== null && hub.ctx.length === 0
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        text: "Belum ada sesi Claude Code yang berjalan. Jalankan claude di folder proyek."
                    }
                    Repeater {
                        model: pane.index === 0 && hub.ctx ? hub.ctx : []
                        delegate: ContextRow {
                            required property var modelData
                            title: modelData.name
                            used: modelData.used === null ? -1 : modelData.used
                            window: modelData.window
                        }
                    }
                    PC3.Label {
                        visible: pane.index === 0 && hub.ctx !== null && hub.ctx.length > 0
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        text: "Konteks terpakai dari transkrip sesi, jendela dianggap 1M."
                        font: Kirigami.Theme.smallFont
                        opacity: 0.8
                    }

                    // Services
                    PC3.Label {
                        visible: pane.index === 1 && hub.svc === null
                        text: "Membaca layanan…"
                        opacity: 0.8
                    }
                    Repeater {
                        model: pane.index === 1 && hub.svc ? hub.svc : []
                        delegate: InfoRow {
                            required property var modelData
                            title: modelData.name
                            detail: modelData.state
                            dotColor: modelData.state === "active" ? Kirigami.Theme.positiveTextColor
                                    : (modelData.state === "activating" || modelData.state === "reloading") ? Kirigami.Theme.neutralTextColor
                                    : Kirigami.Theme.negativeTextColor
                        }
                    }

                    // CI
                    PC3.Label {
                        visible: pane.index === 2 && hub.ci === null
                        text: "Membaca status CI…"
                        opacity: 0.8
                    }
                    PC3.Label {
                        visible: pane.index === 2 && hub.ci !== null && hub.ci.length === 0
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        text: "CI mengikuti folder sesi Claude Code yang aktif. Belum ada sesi."
                    }
                    Repeater {
                        model: pane.index === 2 && hub.ci ? hub.ci : []
                        delegate: InfoRow {
                            required property var modelData
                            title: modelData.name
                            detail: modelData.state === "ok" ? "lulus"
                                  : modelData.state === "fail" ? "gagal"
                                  : modelData.state === "run" ? "berjalan"
                                  : modelData.state === "error" ? "gh gagal dibaca"
                                  : "belum ada run"
                            dotColor: modelData.state === "ok" ? Kirigami.Theme.positiveTextColor
                                    : modelData.state === "fail" ? Kirigami.Theme.negativeTextColor
                                    : modelData.state === "run" ? Kirigami.Theme.neutralTextColor
                                    : Kirigami.Theme.disabledTextColor
                        }
                    }

                    PC3.Label {
                        visible: hub.tabError !== "" && tabs.currentIndex === pane.index
                        text: hub.tabError
                        color: Kirigami.Theme.negativeTextColor
                    }
                    Item { Layout.fillHeight: true }
                }
            }
        }
    }
}
