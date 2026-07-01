// 日期时间选择器：触发按钮（单行：⏱ + 显示值 + 距开启）→ 弹层。
// 弹层：手动 年/月/日/时/分（键盘 + ↑↓）· 月历（周一起）· 时/分 · 预设。draft 模式，确认才提交。
// = React DateTimePicker.tsx / Flutter date_time_picker.dart。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../fmt.js" as Fmt

Item {
    id: root
    property var value: new Date()      // JS Date
    signal changed(var d)
    implicitHeight: 46
    readonly property var c: Theme.colors

    function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

    // 触发按钮
    Rectangle {
        anchors.fill: parent
        radius: Theme.sizes.radiusMd
        color: c.surface3
        border.width: 1; border.color: pop.opened ? c.signalPrimary : c.borderDefault
        RowLayout {
            anchors.fill: parent; anchors.leftMargin: 16; anchors.rightMargin: 16; spacing: 12
            Text { text: "⏱"; color: c.signalPrimary; font.pixelSize: 18 }
            Text { text: Fmt.formatDisplay(root.value); color: c.textPrimary; font.pixelSize: Theme.sizes.fsBase; font.weight: Font.Medium; elide: Text.ElideRight }
            Text { text: Fmt.formatDistance(root.value); color: c.textMuted; font.pixelSize: Theme.sizes.fsXs }
            Item { Layout.fillWidth: true }
            Text { text: "⌄"; color: c.signalPrimary; font.pixelSize: 18 }
        }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: pop.openWith() }
    }

    Popup {
        id: pop
        y: root.height + 6
        width: 460
        padding: 20
        modal: true
        focus: true
        property var draft: new Date()
        property int viewYear: 2026
        property int viewMonth: 0   // 0-based

        function openWith() {
            draft = new Date(root.value.getTime())
            viewYear = draft.getFullYear(); viewMonth = draft.getMonth()
            sync()
            open()
        }
        function sync() {
            yf.text = "" + draft.getFullYear(); mf.text = Fmt.pad2(draft.getMonth() + 1); df.text = Fmt.pad2(draft.getDate())
            hf.text = Fmt.pad2(draft.getHours()); minf.text = Fmt.pad2(draft.getMinutes())
        }
        function setDraft(d) { draft = d; viewYear = d.getFullYear(); viewMonth = d.getMonth(); sync() }
        function adjust(field, delta) {
            var d = new Date(draft.getTime())
            if (field === "year") d.setFullYear(d.getFullYear() + delta)
            else if (field === "month") d.setMonth(d.getMonth() + delta)
            else if (field === "day") d.setDate(d.getDate() + delta)
            else if (field === "hour") d.setHours(d.getHours() + delta)
            else d.setMinutes(d.getMinutes() + delta)
            setDraft(d)
        }
        function commitManual() {
            var y = parseInt(yf.text), m = parseInt(mf.text), da = parseInt(df.text), h = parseInt(hf.text), mi = parseInt(minf.text)
            if (yf.text.length !== 4 || isNaN(m) || isNaN(da) || isNaN(h) || isNaN(mi) || isNaN(y)) return
            if (m < 1 || m > 12 || h < 0 || h > 23 || mi < 0 || mi > 59) return
            if (da < 1 || da > root.daysInMonth(y, m - 1)) return
            draft = new Date(y, m - 1, da, h, mi); viewYear = y; viewMonth = m - 1
        }
        function preset(spec) {
            var d = new Date(); d.setSeconds(0, 0)
            if (spec === "1m") d.setMinutes(d.getMinutes() + 2)
            else if (spec === "1h") d.setHours(d.getHours() + 1)
            else if (spec === "tomorrow9") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0) }
            else if (spec === "1y") d.setFullYear(d.getFullYear() + 1)
            else d = new Date(2030, 0, 1, 0, 0)
            setDraft(d)
        }

        background: Rectangle {
            color: c.surface1; radius: Theme.sizes.radiusLg
            border.width: 1; border.color: c.borderSubtle
        }

        contentItem: ColumnLayout {
            spacing: 14
            // topbar
            RowLayout {
                Layout.fillWidth: true
                ColumnLayout {
                    spacing: 0
                    Text { text: "选择开启时刻"; color: c.textMuted; font.pixelSize: Theme.sizes.fsXs }
                    Text { text: Fmt.formatDistance(pop.draft); color: c.signalPrimary; font.pixelSize: Theme.sizes.fsBase; font.weight: Font.DemiBold }
                }
                Item { Layout.fillWidth: true }
                HtButton { text: "取消"; variant: "ghost"; size: "sm"; onClicked: pop.close() }
                HtButton { text: "确认"; variant: "primary"; size: "sm"; onClicked: { root.value = pop.draft; root.changed(pop.draft); pop.close() } }
            }
            // 手动输入
            RowLayout {
                spacing: 3
                component MF: TextField {
                    property string field: ""
                    Layout.preferredWidth: field === "year" ? 56 : 40
                    horizontalAlignment: TextInput.AlignHCenter
                    color: c.textPrimary; font.pixelSize: Theme.sizes.fsBase
                    inputMethodHints: Qt.ImhDigitsOnly
                    validator: RegularExpressionValidator { regularExpression: /[0-9]{0,4}/ }
                    background: Rectangle { radius: Theme.sizes.radiusSm; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault }
                    onTextEdited: pop.commitManual()
                    Keys.onUpPressed: pop.adjust(field, 1)
                    Keys.onDownPressed: pop.adjust(field, -1)
                }
                MF { id: yf; field: "year" }
                Text { text: "年"; color: c.textSecondary; Layout.alignment: Qt.AlignVCenter }
                MF { id: mf; field: "month" }
                Text { text: "月"; color: c.textSecondary; Layout.alignment: Qt.AlignVCenter }
                MF { id: df; field: "day" }
                Text { text: "日"; color: c.textSecondary; Layout.alignment: Qt.AlignVCenter }
                MF { id: hf; field: "hour" }
                Text { text: ":"; color: c.textSecondary; Layout.alignment: Qt.AlignVCenter }
                MF { id: minf; field: "minute" }
            }
            // 月历
            ColumnLayout {
                Layout.fillWidth: true; spacing: 4
                RowLayout {
                    Layout.fillWidth: true
                    HtButton { text: "‹"; variant: "ghost"; size: "sm"; onClicked: { var d = new Date(pop.viewYear, pop.viewMonth - 1, 1); pop.viewYear = d.getFullYear(); pop.viewMonth = d.getMonth() } }
                    Item { Layout.fillWidth: true }
                    Text { text: pop.viewYear + "年" + (pop.viewMonth + 1) + "月"; color: c.textPrimary; font.weight: Font.DemiBold }
                    Item { Layout.fillWidth: true }
                    HtButton { text: "›"; variant: "ghost"; size: "sm"; onClicked: { var d = new Date(pop.viewYear, pop.viewMonth + 1, 1); pop.viewYear = d.getFullYear(); pop.viewMonth = d.getMonth() } }
                }
                Grid {
                    Layout.fillWidth: true
                    columns: 7
                    Repeater {
                        model: ["一", "二", "三", "四", "五", "六", "日"]
                        delegate: Item { width: 56; height: 24; Text { anchors.centerIn: parent; text: modelData; color: c.textMuted; font.pixelSize: Theme.sizes.fsXs } }
                    }
                    Repeater {
                        model: (new Date(pop.viewYear, pop.viewMonth, 1).getDay() + 6) % 7
                        delegate: Item { width: 56; height: 34 }
                    }
                    Repeater {
                        model: root.daysInMonth(pop.viewYear, pop.viewMonth)
                        delegate: Item {
                            required property int index
                            readonly property int day: index + 1
                            readonly property bool sel: pop.draft.getFullYear() === pop.viewYear && pop.draft.getMonth() === pop.viewMonth && pop.draft.getDate() === day
                            width: 56; height: 34
                            Rectangle {
                                anchors.centerIn: parent; width: 30; height: 30; radius: 15
                                color: sel ? c.signalPrimary : "transparent"
                                Text { anchors.centerIn: parent; text: day; color: sel ? c.signalOn : c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                            }
                            MouseArea {
                                anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                                onClicked: { var d = new Date(pop.draft.getTime()); d.setFullYear(pop.viewYear, pop.viewMonth, day); pop.draft = d; pop.sync() }
                            }
                        }
                    }
                }
            }
            // 时/分
            RowLayout {
                spacing: 12
                ColumnLayout { spacing: 4; Text { text: "小时"; color: c.textMuted; font.pixelSize: Theme.sizes.fsXs }
                    SpinBox { from: 0; to: 23; value: pop.draft.getHours(); onValueModified: { var d = new Date(pop.draft.getTime()); d.setHours(value); pop.draft = d; pop.sync() } } }
                ColumnLayout { spacing: 4; Text { text: "分钟"; color: c.textMuted; font.pixelSize: Theme.sizes.fsXs }
                    SpinBox { from: 0; to: 59; value: pop.draft.getMinutes(); onValueModified: { var d = new Date(pop.draft.getTime()); d.setMinutes(value); pop.draft = d; pop.sync() } } }
            }
            // 预设
            Flow {
                Layout.fillWidth: true; spacing: 8
                HtButton { text: "1分钟后"; variant: "ghost"; size: "sm"; onClicked: pop.preset("1m") }
                HtButton { text: "1小时后"; variant: "ghost"; size: "sm"; onClicked: pop.preset("1h") }
                HtButton { text: "明天9:00"; variant: "ghost"; size: "sm"; onClicked: pop.preset("tomorrow9") }
                HtButton { text: "1年后"; variant: "ghost"; size: "sm"; onClicked: pop.preset("1y") }
                HtButton { text: "2030.01.01"; variant: "ghost"; size: "sm"; onClicked: pop.preset("y2030") }
            }
        }
    }
}
