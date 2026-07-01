// 居中容器（= cy-container）：限制最大宽度并水平居中，内容垂直堆叠。
import QtQuick
import QtQuick.Layouts

Item {
    id: root
    default property alias content: col.data
    property int maxWidth: 1180
    property int hpad: 24
    property int vpad: 32
    property int spacing: 16
    implicitHeight: col.implicitHeight + vpad * 2

    ColumnLayout {
        id: col
        width: Math.min(root.width - root.hpad * 2, root.maxWidth)
        anchors.horizontalCenter: parent.horizontalCenter
        y: root.vpad
        spacing: root.spacing
    }
}
