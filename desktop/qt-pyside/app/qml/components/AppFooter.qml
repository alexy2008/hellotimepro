// 页脚：版权 + 后端在线点 + 技术栈（桌面端 Flutter→此处 Qt/PySide + 后端 from health）。
// = React AppFooter.tsx / Flutter app_footer.dart。
import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root
    height: 64
    color: Theme.colors.surface0
    readonly property var c: Theme.colors

    property var health: null
    property int connected: 0   // 0 未知 / 1 在线 / -1 离线

    // 桌面端原生技术栈（对照 React 三件套 / SwiftUI 的 SwiftUI+Swift / Flutter+Dart）
    readonly property var desktopStack: [
        { name: "Qt Quick", icon: "/static/icons/qt.svg" },
        { name: "PySide6", icon: "/static/icons/python.svg" }
    ]

    Component.onCompleted: Api.health()
    Connections {
        target: Api
        function onHealthReady(h) { root.health = h; root.connected = 1 }
        function onHealthError() { root.connected = -1 }
    }

    Rectangle { width: parent.width; height: 1; anchors.top: parent.top; color: c.borderSubtle }

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 24
        anchors.rightMargin: 24
        spacing: 8

        Text { text: "© 2026 HelloTime Pro"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
        Rectangle {
            width: 8; height: 8; radius: 4
            color: root.connected === 1 ? c.successSolid : (root.connected === -1 ? c.dangerSolid : c.textDisabled)
        }

        Item { Layout.fillWidth: true }

        Row {
            spacing: 16
            Repeater {
                model: root.desktopStack
                delegate: stackItem
            }
            Repeater {
                model: root.health ? root.health.stack.items : []
                delegate: stackItem
            }
        }
    }

    Component {
        id: stackItem
        Row {
            spacing: 4
            anchors.verticalCenter: parent ? parent.verticalCenter : undefined
            Image {
                visible: !!(modelData.icon || modelData.iconUrl)
                source: (modelData.icon || modelData.iconUrl) ? Api.resolveAsset(modelData.icon || modelData.iconUrl) : ""
                sourceSize.width: 16; sourceSize.height: 16; width: 16; height: 16
                anchors.verticalCenter: parent.verticalCenter
            }
            Text { text: modelData.name; color: root.c.textMuted; font.pixelSize: Theme.sizes.fsXs; anchors.verticalCenter: parent.verticalCenter }
        }
    }
}
