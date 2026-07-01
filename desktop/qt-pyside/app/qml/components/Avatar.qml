// 圆形头像：远程 SVG（后端 /static/avatars/<id>.svg），圆形遮罩；加载失败回退首字母圆牌。
import QtQuick
import QtQuick.Effects

Item {
    id: root
    property string avatarId: ""
    property string nickname: ""
    property int size: 36
    implicitWidth: size
    implicitHeight: size

    // 兜底：首字母圆牌
    Rectangle {
        anchors.fill: parent
        radius: width / 2
        color: Theme.colors.brandPrimary
        visible: img.status !== Image.Ready
        Text {
            anchors.centerIn: parent
            text: root.nickname.length > 0 ? root.nickname.charAt(0).toUpperCase() : "?"
            color: "white"
            font.pixelSize: root.size * 0.45
            font.bold: true
        }
    }

    Image {
        id: img
        anchors.fill: parent
        source: Api.avatarUrl(root.avatarId)
        sourceSize.width: root.size * 2
        sourceSize.height: root.size * 2
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        cache: true
        visible: false
    }

    Rectangle {
        id: mask
        anchors.fill: parent
        radius: width / 2
        visible: false
        layer.enabled: true
    }

    MultiEffect {
        anchors.fill: parent
        source: img
        maskEnabled: true
        maskSource: mask
        visible: img.status === Image.Ready
    }
}
