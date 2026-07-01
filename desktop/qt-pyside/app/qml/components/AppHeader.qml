// 顶部导航：logo + 广场/开启/关于 + 主题切换 + 用户菜单（或登录/注册）。
// = React AppHeader.tsx / Flutter app_header.dart。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: root
    height: 64
    color: Theme.colors.surface0
    readonly property var c: Theme.colors
    readonly property string route: ApplicationWindow.window ? ApplicationWindow.window.currentRoute : ""

    Rectangle { width: parent.width; height: 1; anchors.bottom: parent.bottom; color: c.borderSubtle }

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 24
        anchors.rightMargin: 24
        spacing: 12

        // 品牌
        MouseArea {
            Layout.preferredWidth: brandRow.implicitWidth
            Layout.fillHeight: true
            cursorShape: Qt.PointingHandCursor
            onClicked: ApplicationWindow.window.go("plaza")
            Row {
                id: brandRow
                anchors.verticalCenter: parent.verticalCenter
                spacing: 8
                Image { source: logoUrl; sourceSize.width: 32; sourceSize.height: 32; width: 32; height: 32; anchors.verticalCenter: parent.verticalCenter }
                Text { text: "HelloTime"; color: c.textPrimary; font.pixelSize: Theme.sizes.fsXl; font.bold: true; anchors.verticalCenter: parent.verticalCenter }
                Rectangle {
                    anchors.verticalCenter: parent.verticalCenter
                    width: pro.implicitWidth + 14; height: pro.implicitHeight + 6; radius: height / 2
                    color: Qt.rgba(c.brandSubtle.r, c.brandSubtle.g, c.brandSubtle.b, 0.5)
                    Text { id: pro; anchors.centerIn: parent; text: "PRO"; color: c.accentPrimary; font.pixelSize: Theme.sizes.fsSm; font.bold: true }
                }
            }
        }

        NavLink { label: "广场"; active: root.route === "plaza"; onClicked: ApplicationWindow.window.go("plaza") }
        NavLink { label: "开启"; active: root.route === "open"; onClicked: ApplicationWindow.window.go("open") }
        NavLink { label: "关于"; active: root.route === "about"; onClicked: ApplicationWindow.window.go("about") }

        Item { Layout.fillWidth: true }

        // 主题切换
        ToolButton {
            text: Theme.dark ? "🌙" : "☀"
            font.pixelSize: 16
            onClicked: Theme.toggle()
            ToolTip.visible: hovered
            ToolTip.text: Theme.dark ? "切换到浅色" : "切换到深色"
        }

        // 用户菜单 / 登录注册
        Loader {
            Layout.preferredHeight: 36
            sourceComponent: Auth.isAuthenticated ? userChip : authButtons
        }
    }

    Component {
        id: authButtons
        Row {
            spacing: 8
            anchors.verticalCenter: parent ? parent.verticalCenter : undefined
            HtButton { text: "登录"; variant: "ghost"; size: "sm"; onClicked: ApplicationWindow.window.go("login") }
            HtButton { text: "注册"; variant: "primary"; size: "sm"; onClicked: ApplicationWindow.window.go("register") }
        }
    }

    Component {
        id: userChip
        Item {
            width: chipRow.implicitWidth + 20
            height: 36
            Rectangle {
                anchors.fill: parent; radius: height / 2; color: "transparent"
                border.width: 1; border.color: c.borderSubtle
            }
            Row {
                id: chipRow
                anchors.centerIn: parent
                spacing: 8
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: Auth.user ? Auth.user.nickname.substring(0, 4) : ""
                    color: c.textPrimary; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.Medium
                }
                Avatar { avatarId: Auth.user ? Auth.user.avatarId : ""; nickname: Auth.user ? Auth.user.nickname : ""; size: 24; anchors.verticalCenter: parent.verticalCenter }
                Text { anchors.verticalCenter: parent.verticalCenter; text: "⌄"; color: c.textMuted }
            }
            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: userMenu.open() }
            Menu {
                id: userMenu
                y: parent.height + 4
                MenuItem { text: "📝 我创建的"; onTriggered: ApplicationWindow.window.go("me-created") }
                MenuItem { text: "♥ 我收藏的"; onTriggered: ApplicationWindow.window.go("me-favorites") }
                MenuItem { text: "⚙ 账号设置"; onTriggered: ApplicationWindow.window.go("me-profile") }
                MenuSeparator {}
                MenuItem { text: "↩ 登出"; onTriggered: { Auth.logout(); ApplicationWindow.window.go("plaza") } }
            }
        }
    }
}
