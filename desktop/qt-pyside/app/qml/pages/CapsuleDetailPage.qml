// 胶囊详情：徽章/码/标题；已开→正文，未开→翻页时钟倒计时 + 到期自动开启轮询；
// 复制 8 位码 / 分享 / 收藏。= React CapsuleDetail.tsx / Flutter capsule_by_code_page.dart。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"
import "../fmt.js" as Fmt

ScrollView {
    id: page
    property string route: "detail"
    property string code: ""
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    readonly property var c: Theme.colors

    property var cap: null
    property string err: ""
    property bool loading: true
    property bool codeCopied: false
    property bool linkCopied: false
    property real nowMs: Date.now()

    Component.onCompleted: Api.capsuleByCode(code)
    Connections {
        target: Api
        function onCapsuleLoaded(data) { page.cap = data; page.err = ""; page.loading = false; page.setupTimers() }
        function onCapsuleError(m) { page.err = "胶囊不存在"; page.loading = false }
    }
    // 收藏态变化同步到详情头
    Connections {
        target: Capsules
        function onFavoriteChanged(id, fav, cnt) {
            if (page.cap && id === page.cap.id) {
                var x = page.cap; x.favoritedByMe = fav; x.favoriteCount = cnt; page.cap = x
            }
        }
    }

    Timer { id: ticker; interval: 1000; repeat: true; running: page.cap && !page.cap.isOpened; onTriggered: page.nowMs = Date.now() }
    Timer {
        id: autoOpen; interval: 1000; repeat: true
        running: page.cap && !page.cap.isOpened && Fmt.countdownTo(page.cap.openAt, page.nowMs).expired
        onTriggered: Api.capsuleByCode(page.code)
    }
    function setupTimers() {}

    readonly property var cd: page.cap ? Fmt.countdownTo(page.cap.openAt, page.nowMs) : null

    ColumnLayout {
        width: Math.min(page.availableWidth - 48, 720)
        anchors.horizontalCenter: parent.horizontalCenter
        y: 32
        spacing: 16

        HtButton { text: "‹ 返回"; variant: "ghost"; size: "sm"; onClicked: ApplicationWindow.window.back() }

        BusyIndicator { Layout.alignment: Qt.AlignHCenter; running: page.loading; visible: page.loading }

        // 不存在
        ColumnLayout {
            Layout.fillWidth: true; spacing: 12
            visible: !page.loading && !page.cap
            HtAlert { Layout.fillWidth: true; variant: "danger"; text: page.err || "胶囊不存在" }
            HtButton { text: "返回输入码"; variant: "ghost"; onClicked: ApplicationWindow.window.go("open") }
        }

        // 详情主体
        ColumnLayout {
            Layout.fillWidth: true; spacing: 16
            visible: !!page.cap

            Flow {
                Layout.fillWidth: true; spacing: 8
                Badge { label: (page.cap && page.cap.isOpened) ? "已开启" : "未开启"; accent: (page.cap && page.cap.isOpened) ? c.capsuleOpenedAccent : c.capsuleSealedAccent }
                Badge { visible: page.cap && page.cap.inPlaza; label: "广场公开"; accent: c.brandPrimary }
                Text { text: page.cap ? page.cap.code : ""; color: c.textLink; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.DemiBold }
                Text { text: page.cap ? "· 创建于 " + Fmt.fmtDateTime(page.cap.createdAt) : ""; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
            }

            Text { Layout.fillWidth: true; text: page.cap ? page.cap.title : ""; color: c.textPrimary; font.pixelSize: Theme.sizes.fs4xl; font.bold: true; wrapMode: Text.WordWrap }

            // 已开启：正文
            ColumnLayout {
                Layout.fillWidth: true; spacing: 12
                visible: page.cap && page.cap.isOpened && page.cap.content !== null
                RowLayout {
                    spacing: 6
                    Text { text: "🔓 开启于 "; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                    Text { text: page.cap ? Fmt.fmtDateTime(page.cap.openAt) : ""; color: c.capsuleOpenedAccent; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.DemiBold }
                }
                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: contentText.implicitHeight + 40
                    radius: Theme.sizes.radiusLg; color: c.surface1
                    border.width: 1; border.color: c.borderSubtle
                    TextEdit {
                        id: contentText
                        anchors.fill: parent; anchors.margins: 20
                        text: page.cap ? (page.cap.content || "") : ""
                        readOnly: true; selectByMouse: true; wrapMode: TextEdit.WordWrap
                        color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase
                    }
                }
            }

            // 未开启：封存 + 倒计时
            Rectangle {
                Layout.fillWidth: true
                visible: page.cap && !page.cap.isOpened
                implicitHeight: sealedCol.implicitHeight + 64
                radius: Theme.sizes.radiusXl; color: c.surface1
                border.width: 1; border.color: Qt.rgba(c.capsuleSealedBorder.r, c.capsuleSealedBorder.g, c.capsuleSealedBorder.b, 0.5)
                ColumnLayout {
                    id: sealedCol
                    anchors.centerIn: parent
                    width: parent.width - 32
                    spacing: 16
                    Text { Layout.alignment: Qt.AlignHCenter; text: "🔒"; font.pixelSize: Theme.sizes.fs4xl }
                    Text { Layout.alignment: Qt.AlignHCenter; text: "这封信还在上锁，将在以下时刻开启"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                    FlipClock {
                        Layout.alignment: Qt.AlignHCenter
                        days: page.cd ? page.cd.days : 0; hours: page.cd ? page.cd.hours : 0
                        minutes: page.cd ? page.cd.minutes : 0; seconds: page.cd ? page.cd.seconds : 0
                        accent: c.capsuleSealedAccent
                    }
                    Text {
                        Layout.alignment: Qt.AlignHCenter
                        text: (page.cd && page.cd.expired) ? "正在同步开启状态…" : (page.cap ? "开启于 " + Fmt.fmtDateTime(page.cap.openAt) : "")
                        color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm
                    }
                }
            }

            // footer
            Flow {
                Layout.fillWidth: true; Layout.topMargin: 8; spacing: 12
                Row {
                    spacing: 6
                    Text { anchors.verticalCenter: parent.verticalCenter; text: "来自 "; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
                    Avatar { avatarId: page.cap && page.cap.creator ? page.cap.creator.avatarId : ""; nickname: page.cap && page.cap.creator ? page.cap.creator.nickname : ""; size: 28; anchors.verticalCenter: parent.verticalCenter }
                    Text { anchors.verticalCenter: parent.verticalCenter; text: page.cap && page.cap.creator ? page.cap.creator.nickname : ""; color: c.textPrimary; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.DemiBold }
                }
            }
            RowLayout {
                Layout.fillWidth: true; spacing: 8
                HtButton {
                    text: page.codeCopied ? "✓ 已复制!" : "📎 复制 8 位码"; variant: "ghost"; size: "sm"
                    onClicked: { Api.setClipboard(page.cap.code); page.codeCopied = true; copyT.restart() }
                }
                HtButton {
                    text: page.linkCopied ? "✓ 已复制!" : "🔗 分享"; variant: "ghost"; size: "sm"
                    onClicked: { Api.setClipboard("用胶囊码 " + page.cap.code + " 在 HelloTime Pro 打开（开启 → 输入码）"); page.linkCopied = true; linkT.restart() }
                }
                Item { Layout.fillWidth: true }
                FavoriteButton {
                    size: "md"
                    capsuleId: page.cap ? page.cap.id : ""
                    favoritedByMe: page.cap ? page.cap.favoritedByMe : false
                    favoriteCount: page.cap ? page.cap.favoriteCount : 0
                }
            }
            Timer { id: copyT; interval: 2000; onTriggered: page.codeCopied = false }
            Timer { id: linkT; interval: 2000; onTriggered: page.linkCopied = false }

            HtAlert {
                Layout.fillWidth: true
                visible: page.cap && !page.cap.isOpened
                variant: "info"; text: "未开启的胶囊仅显示标题与倒计时，内容将在开启后公开。"
            }
            HtAlert {
                Layout.fillWidth: true
                visible: page.cap && page.cap.isOpened && page.cap.inPlaza
                variant: "success"; text: "这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。"
            }
        }
    }
}
