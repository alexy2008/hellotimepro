// 凭 8 位码开启：码输入 + 开启 / 粘贴识别。成功跳详情。
// = React OpenPage.tsx / Flutter open_page.dart。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"

ScrollView {
    id: page
    property string route: "open"
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    readonly property var c: Theme.colors

    property string code: ""
    property bool busy: false
    property string err: ""

    function open(cd) {
        if (cd.length !== 8) return
        err = ""; busy = true
        Api.capsuleByCode(cd)
    }
    Connections {
        target: Api
        function onCapsuleLoaded(cap) { if (page.busy) { page.busy = false; ApplicationWindow.window.push("detail", { code: cap.code }) } }
        function onCapsuleError(m) { if (page.busy) { page.busy = false; page.err = "找不到这条胶囊" } }
    }

    ColumnLayout {
        width: Math.min(page.availableWidth - 48, 720)
        anchors.horizontalCenter: parent.horizontalCenter
        y: 48
        spacing: 16

        Text { Layout.alignment: Qt.AlignHCenter; text: "用 8 位密钥开启胶囊"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs3xl; font.bold: true }
        Text {
            Layout.fillWidth: true; horizontalAlignment: Text.AlignHCenter; wrapMode: Text.WordWrap
            text: "输入朋友分享给你的 8 位大写字母和数字，可直接查看胶囊。"
            color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase
        }
        CapsuleCodeInput {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 16; Layout.bottomMargin: 16
            value: page.code
            onChanged: (v) => page.code = v
            onCompleted: (v) => page.open(v)
        }
        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            spacing: 12
            HtButton { text: page.busy ? "查询中…" : "开启 →"; variant: "primary"; size: "lg"; loading: page.busy; enabled: !page.busy && page.code.length === 8; onClicked: page.open(page.code) }
            HtButton {
                text: "粘贴识别"; variant: "ghost"; size: "lg"
                onClicked: {
                    var t = Api.clipboardText().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
                    page.code = t
                    if (t.length === 8) page.open(t)
                }
            }
        }
        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 24
            spacing: 16
            Text { text: "🔗 可用 /c/<code> 直链访问"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
            Text { text: "🔒 未到时间的胶囊也会显示倒计时"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
        }
        HtAlert { Layout.alignment: Qt.AlignHCenter; Layout.maximumWidth: 480; Layout.fillWidth: true; visible: page.err !== ""; variant: "danger"; text: page.err }
    }
}
