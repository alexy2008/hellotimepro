// 8 位胶囊码逐格输入：自动前进 / 退格回退 / 大写过滤。
// = React CapsuleCodeInput.tsx / Flutter capsule_code_input.dart。
import QtQuick
import QtQuick.Controls

Row {
    id: root
    property string value: ""
    signal changed(string v)
    signal completed(string v)
    spacing: 8

    function collect() {
        var s = ""
        for (var i = 0; i < rep.count; i++) s += rep.itemAt(i).text
        return s
    }
    function setValue(v) {
        for (var i = 0; i < rep.count; i++) rep.itemAt(i).text = i < v.length ? v.charAt(i).toUpperCase() : ""
    }
    onValueChanged: if (collect() !== value) setValue(value)

    Repeater {
        id: rep
        model: 8
        delegate: TextField {
            required property int index
            width: 44; height: 54
            horizontalAlignment: TextInput.AlignHCenter
            verticalAlignment: TextInput.AlignVCenter
            maximumLength: 1
            color: Theme.colors.textPrimary
            font.pixelSize: Theme.sizes.fsXl; font.bold: true
            background: Rectangle {
                radius: Theme.sizes.radiusMd
                color: Theme.colors.surface3
                border.width: parent.activeFocus ? 1.5 : 1
                border.color: parent.activeFocus ? Theme.colors.signalPrimary : Theme.colors.borderDefault
            }
            onTextChanged: {
                var up = text.toUpperCase().replace(/[^A-Z0-9]/g, "")
                if (up !== text) { text = up.slice(-1); return }
                if (text.length > 0 && index < 7) rep.itemAt(index + 1).forceActiveFocus()
                var v = root.collect()
                root.changed(v)
                if (v.length === 8) root.completed(v)
            }
            Keys.onPressed: function(e) {
                if (e.key === Qt.Key_Backspace && text.length === 0 && index > 0) {
                    rep.itemAt(index - 1).forceActiveFocus()
                    rep.itemAt(index - 1).text = ""
                    root.changed(root.collect())
                    e.accepted = true
                }
            }
        }
    }
}
