// 「我的」左侧栏：我创建的 / 我收藏的 / 账号设置 / 登出（= React MeLayout 侧栏）。
import QtQuick
import QtQuick.Layouts

ColumnLayout {
    id: root
    property string current: ""   // me-created | me-favorites | me-profile
    readonly property var c: Theme.colors
    spacing: 4

    component NavItem: Rectangle {
        property string icon: ""
        property string label: ""
        property string target: ""
        Layout.fillWidth: true
        implicitHeight: 40
        radius: Theme.sizes.radiusMd
        readonly property bool active: root.current === target
        color: active ? Qt.rgba(c.signalSubtle.r, c.signalSubtle.g, c.signalSubtle.b, 0.5) : "transparent"
        Row {
            anchors.fill: parent; anchors.leftMargin: 12; spacing: 10
            Text { anchors.verticalCenter: parent.verticalCenter; text: icon; color: active ? c.signalPrimary : c.textSecondary; font.pixelSize: 14 }
            Text { anchors.verticalCenter: parent.verticalCenter; text: label; color: active ? c.signalPrimary : c.textSecondary; font.pixelSize: Theme.sizes.fsBase; font.weight: active ? Font.DemiBold : Font.Normal }
        }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: ApplicationWindow.window.go(target) }
    }

    NavItem { icon: "📝"; label: "我创建的"; target: "me-created" }
    NavItem { icon: "♥"; label: "我收藏的"; target: "me-favorites" }
    NavItem { icon: "⚙"; label: "账号设置"; target: "me-profile" }
    Rectangle { Layout.fillWidth: true; height: 1; color: c.borderSubtle; Layout.topMargin: 8; Layout.bottomMargin: 8 }
    Rectangle {
        Layout.fillWidth: true; implicitHeight: 40; radius: Theme.sizes.radiusMd; color: "transparent"
        Row {
            anchors.fill: parent; anchors.leftMargin: 12; spacing: 10
            Text { anchors.verticalCenter: parent.verticalCenter; text: "↩"; color: c.dangerFg }
            Text { anchors.verticalCenter: parent.verticalCenter; text: "登出"; color: c.dangerFg; font.pixelSize: Theme.sizes.fsBase }
        }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { Auth.logout(); ApplicationWindow.window.go("plaza") } }
    }
}
