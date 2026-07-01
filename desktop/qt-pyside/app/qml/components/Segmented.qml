// 分段控件：胶囊底 + 选中项信号青 + 辉光（= cy-seg）。
import QtQuick

Rectangle {
    id: root
    property var options: []      // [[key,label], ...]
    property string current: ""
    signal pick(string key)
    readonly property var c: Theme.colors

    implicitWidth: row.implicitWidth + 8
    implicitHeight: 38
    radius: height / 2
    color: c.surface2

    Row {
        id: row
        anchors.centerIn: parent
        spacing: 0
        Repeater {
            model: root.options
            delegate: Rectangle {
                required property var modelData
                readonly property bool sel: modelData[0] === root.current
                width: lbl.implicitWidth + 28
                height: 30
                radius: height / 2
                color: sel ? root.c.signalPrimary : "transparent"
                Text {
                    id: lbl
                    anchors.centerIn: parent
                    text: modelData[1]
                    color: sel ? root.c.signalOn : root.c.textSecondary
                    font.pixelSize: Theme.sizes.fsSm
                    font.weight: sel ? Font.DemiBold : Font.Normal
                }
                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.pick(modelData[0]) }
            }
        }
    }
}
