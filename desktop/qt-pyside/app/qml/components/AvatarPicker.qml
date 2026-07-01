// 头像选择器：10 个内置 SVG 头像，选中描边 + 辉光（= React AvatarPicker.tsx）。
import QtQuick

Flow {
    id: root
    property var avatars: []
    property string value: ""
    signal pick(string id)
    spacing: 10

    Repeater {
        model: root.avatars
        delegate: Item {
            required property var modelData
            readonly property bool sel: modelData.id === root.value
            width: 52; height: 52
            Rectangle {
                anchors.fill: parent; radius: width / 2; color: "transparent"
                border.width: sel ? 2 : 1
                border.color: sel ? Theme.colors.signalPrimary : Theme.colors.borderSubtle
            }
            Avatar { anchors.centerIn: parent; avatarId: modelData.id; nickname: modelData.name; size: 44 }
            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.pick(modelData.id) }
        }
    }
}
