// 账号设置：基本信息（昵称/头像）+ 修改密码（改后 3 秒登出）。= React MeProfilePage.tsx。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"

ScrollView {
    id: page
    property string route: "me-profile"
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    readonly property var c: Theme.colors

    property var avatars: []
    property string avatarId: Auth.user ? Auth.user.avatarId : ""
    property string profileMsg: ""
    property string profileVariant: "info"
    property string pwdMsg: ""
    property string pwdVariant: "danger"

    Component.onCompleted: Api.avatars()
    Connections {
        target: Api
        function onAvatarsReady(list) { page.avatars = list }
        function onProfileSaved(u) { page.profileVariant = "success"; page.profileMsg = "已保存" }
        function onProfileError(m) { page.profileVariant = "danger"; page.profileMsg = m }
        function onPasswordChanged() { page.pwdVariant = "success"; page.pwdMsg = "密码已更新，3 秒后将自动登出。"; logoutTimer.start() }
        function onPasswordError(m) { page.pwdVariant = "danger"; page.pwdMsg = m }
    }
    Timer { id: logoutTimer; interval: 3000; onTriggered: { Auth.logout(); ApplicationWindow.window.go("login") } }

    RowLayout {
        width: Math.min(page.availableWidth - 48, 1180)
        anchors.horizontalCenter: parent.horizontalCenter
        y: 32
        spacing: 32

        MeSidebar { Layout.preferredWidth: 200; Layout.alignment: Qt.AlignTop; current: "me-profile" }

        ColumnLayout {
            Layout.fillWidth: true; Layout.alignment: Qt.AlignTop; spacing: 16; Layout.bottomMargin: 32
            Text { text: "账号设置"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs2xl; font.bold: true }

            // 基本信息
            Rectangle {
                Layout.fillWidth: true; implicitHeight: pf.implicitHeight + 48
                radius: Theme.sizes.radiusLg; color: c.surface1; border.width: 1; border.color: c.borderSubtle
                ColumnLayout {
                    id: pf
                    anchors.fill: parent; anchors.margins: 24; spacing: 12
                    Text { text: "基本信息"; color: c.textPrimary; font.pixelSize: Theme.sizes.fsXl; font.weight: Font.DemiBold }
                    Text { text: "邮箱"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                    TextField { Layout.fillWidth: true; enabled: false; text: Auth.user ? Auth.user.email : ""; color: c.textDisabled; background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: c.borderDefault } }
                    Text { text: "邮箱作为登录账号不可修改。"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                    Text { text: "昵称"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                    TextField { id: nick; Layout.fillWidth: true; maximumLength: 20; text: Auth.user ? Auth.user.nickname : ""; color: c.textPrimary; background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault } }
                    Text { text: "头像"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                    AvatarPicker { Layout.fillWidth: true; avatars: page.avatars; value: page.avatarId; onPick: (id) => page.avatarId = id }
                    HtAlert { Layout.fillWidth: true; visible: page.profileMsg !== ""; variant: page.profileVariant; text: page.profileMsg }
                    RowLayout {
                        Layout.alignment: Qt.AlignRight
                        HtButton { text: "重置"; variant: "ghost"; onClicked: { nick.text = Auth.user ? Auth.user.nickname : ""; page.avatarId = Auth.user ? Auth.user.avatarId : "" } }
                        HtButton {
                            text: "保存更改"; variant: "primary"
                            onClicked: {
                                page.profileMsg = ""
                                var nn = (Auth.user && nick.text !== Auth.user.nickname) ? nick.text.trim() : ""
                                var av = (Auth.user && page.avatarId !== Auth.user.avatarId) ? page.avatarId : ""
                                if (nn === "" && av === "") { page.profileVariant = "info"; page.profileMsg = "没有改动"; return }
                                Api.updateProfile(nn, av)
                            }
                        }
                    }
                }
            }

            // 修改密码
            Rectangle {
                Layout.fillWidth: true; implicitHeight: pw.implicitHeight + 48
                radius: Theme.sizes.radiusLg; color: c.surface1; border.width: 1; border.color: c.borderSubtle
                ColumnLayout {
                    id: pw
                    anchors.fill: parent; anchors.margins: 24; spacing: 12
                    Text { text: "修改密码"; color: c.textPrimary; font.pixelSize: Theme.sizes.fsXl; font.weight: Font.DemiBold }
                    Text { text: "当前密码"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                    TextField { id: oldp; Layout.fillWidth: true; echoMode: TextInput.Password; color: c.textPrimary; background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault } }
                    Text { text: "新密码"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                    TextField { id: newp; Layout.fillWidth: true; echoMode: TextInput.Password; color: c.textPrimary; background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault } }
                    Text { text: "至少 8 位且需含字母和数字；保存后所有 refresh token 会被吊销。"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                    Text { text: "确认新密码"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                    TextField { id: confp; Layout.fillWidth: true; echoMode: TextInput.Password; color: c.textPrimary; background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault } }
                    HtAlert { Layout.fillWidth: true; visible: page.pwdMsg !== ""; variant: page.pwdVariant; text: page.pwdMsg }
                    HtButton {
                        Layout.alignment: Qt.AlignRight
                        text: "更新密码"; variant: "primary"
                        onClicked: {
                            page.pwdMsg = ""
                            if (newp.text !== confp.text) { page.pwdVariant = "danger"; page.pwdMsg = "两次输入的新密码不一致"; return }
                            Api.changePassword(oldp.text, newp.text)
                        }
                    }
                }
            }
        }
    }
}
