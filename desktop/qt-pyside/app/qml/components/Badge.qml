// 胶囊状态/属性小徽章。
import QtQuick

Rectangle {
    property string label: ""
    property color accent: Theme.colors.signalPrimary
    implicitWidth: txt.implicitWidth + 16
    implicitHeight: txt.implicitHeight + 6
    radius: height / 2
    color: Qt.rgba(accent.r, accent.g, accent.b, 0.12)
    Text {
        id: txt
        anchors.centerIn: parent
        text: label
        color: accent
        font.pixelSize: Theme.sizes.fsXs
        font.weight: Font.DemiBold
    }
}
