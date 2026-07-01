// 登录：邮箱 + 密码 → Auth.login → loginSucceeded（Main 接管跳转）。= React LoginPage.tsx。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"

ScrollView {
    id: page
    property string route: "login"
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    readonly property var c: Theme.colors
    property string err: ""

    Connections { target: Auth; function onErrorOccurred(m) { page.err = m } }

    ColumnLayout {
        width: Math.min(page.availableWidth - 48, 440)
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
                spacing: 14
                Text { text: "欢迎回来"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs3xl; font.bold: true }
                Text { text: "你留给未来的信，还在等你开启。"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase }
                Text { text: "邮箱"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                TextField { id: email; Layout.fillWidth: true; color: c.textPrimary; background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault } }
                Text { text: "密码"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                TextField { id: pwd; Layout.fillWidth: true; echoMode: TextInput.Password; color: c.textPrimary; onAccepted: doLogin(); background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault } }
                Text { text: "忘记密码？暂不支持找回，请联系管理员重置。"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                HtButton { Layout.fillWidth: true; text: Auth.busy ? "登录中…" : "登录"; variant: "primary"; size: "lg"; loading: Auth.busy; enabled: !Auth.busy; onClicked: doLogin() }
                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    Text { text: "还没有账号？"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                    Text { text: "立即注册"; color: c.textLink; font.pixelSize: Theme.sizes.fsSm; MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: ApplicationWindow.window.go("register") } }
                }
            }
        }
        HtAlert { Layout.fillWidth: true; visible: page.err !== ""; variant: "danger"; text: page.err }
    }

    function doLogin() { page.err = ""; Auth.login(email.text, pwd.text) }
}
