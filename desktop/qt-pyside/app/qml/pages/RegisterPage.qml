// 注册：邮箱/昵称/密码 + 头像选择 → Auth.register → /create。= React RegisterPage.tsx。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"

ScrollView {
    id: page
    property string route: "register"
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    readonly property var c: Theme.colors
    property var avatars: []
    property string avatarId: ""
    property string err: ""

    Component.onCompleted: Api.avatars()
    Connections {
        target: Api
        function onAvatarsReady(list) { page.avatars = list; if (list.length > 0 && page.avatarId === "") page.avatarId = list[0].id }
    }
    Connections { target: Auth; function onErrorOccurred(m) { page.err = m } }

    ColumnLayout {
        width: Math.min(page.availableWidth - 48, 560)
        anchors.horizontalCenter: parent.horizontalCenter
        y: 56
        spacing: 16

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: form.implicitHeight + 48
            radius: Theme.sizes.radiusLg; color: c.surface1
            border.width: 1; border.color: c.borderSubtle
            ColumnLayout {
                id: form
                anchors.fill: parent; anchors.margins: 24
                spacing: 12
                Text { text: "注册新身份"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs3xl; font.bold: true }
                Text { text: "选一个赛博头像、写一封最早 60 秒后才能打开的信。"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase }
                Text { text: "邮箱"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                TextField { id: email; Layout.fillWidth: true; color: c.textPrimary; background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault } }
                Text { text: "昵称"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                TextField { id: nick; Layout.fillWidth: true; maximumLength: 20; color: c.textPrimary; background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault } }
                Text { text: "2–20 字符，注册后可修改。"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                Text { text: "密码"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                TextField { id: pwd; Layout.fillWidth: true; echoMode: TextInput.Password; color: c.textPrimary; background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault } }
                Text { text: "至少 8 位，需包含字母和数字。"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                Text { text: "选择头像（必选）"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                AvatarPicker { Layout.fillWidth: true; avatars: page.avatars; value: page.avatarId; onPick: (id) => page.avatarId = id }
                HtButton {
                    Layout.fillWidth: true; Layout.topMargin: 8
                    text: Auth.busy ? "提交中…" : "创建账号并进入创建胶囊"; variant: "primary"; size: "lg"
                    loading: Auth.busy; enabled: !Auth.busy
                    onClicked: { page.err = ""; if (page.avatarId === "") { page.err = "请选择一个头像"; return } Auth.register(email.text, pwd.text, nick.text, page.avatarId) }
                }
                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    Text { text: "已有账号？"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                    Text { text: "去登录"; color: c.textLink; font.pixelSize: Theme.sizes.fsSm; MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: ApplicationWindow.window.go("login") } }
                }
            }
        }
        HtAlert { Layout.fillWidth: true; visible: page.err !== ""; variant: "danger"; text: page.err }
    }
}
