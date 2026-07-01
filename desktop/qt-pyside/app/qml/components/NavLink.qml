// 顶部导航链接：信号青文字 + 选中下划线（= cy-nav__active）。
import QtQuick
import QtQuick.Layouts

Item {
    id: root
    property string label: ""
    property bool active: false
    signal clicked()
    Layout.preferredWidth: col.implicitWidth + 20
    Layout.fillHeight: true

    Column {
        id: col
        anchors.centerIn: parent
        spacing: 3
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: root.label
            color: root.active ? Theme.colors.signalPrimary : Theme.colors.textSecondary
            font.pixelSize: Theme.sizes.fsBase
            font.weight: Font.Medium
        }
        Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            width: 18; height: 2
            color: root.active ? Theme.colors.signalPrimary : "transparent"
        }
    }
    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.clicked() }
}
