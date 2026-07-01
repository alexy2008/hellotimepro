// 创建胶囊：标题(+AI生成) · AI 推荐灵感 · 正文(计数) · 开启时间(选择器/预设) · 可见性。
// = React CreatePage.tsx / Flutter create_page.dart。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"
import "../fmt.js" as Fmt

ScrollView {
    id: page
    property string route: "create"
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    readonly property var c: Theme.colors

    property var openAt: new Date(Date.now() + 3600 * 1000)
    property bool inPlaza: true
    property bool busy: false
    property string err: ""
    property bool aiBusy: false
    property string aiInfo: ""
    property bool aiGenerated: false
    property var recos: []
    property bool recoBusy: false

    readonly property bool canSubmit: titleField.text.trim().length > 0 && titleField.text.length <= 60 && contentField.text.length > 0 && contentField.text.length <= 5000

    Component.onCompleted: { recoBusy = true; Api.recommendations(4) }

    Connections {
        target: Api
        function onRecommendationsReady(list) { page.recoBusy = false; if (list.items && list.items.length > 0) page.recos = list.items }
        function onSuggestionReady(s) {
            page.aiBusy = false
            contentField.text = s.content
            var d = new Date(s.openAt); if (!isNaN(d.getTime())) page.openAt = d
            page.aiGenerated = true
            if (s.title && titleField.text.trim().length === 0) titleField.text = s.title
            var src = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy
            page.aiInfo = (s.title ? "标题与正文均由 AI 生成" : "已为你生成正文") + "，建议 " + s.openInDays + " 天后开启 · 来源：" + src
        }
        function onSuggestError(m) { page.aiBusy = false; page.err = "AI 生成失败，请稍后重试" }
        function onCapsuleCreated(cap) { page.busy = false; ApplicationWindow.window.go("detail", { code: cap.code }) }
        function onCreateError(m) { page.busy = false; page.err = m }
    }

    function runAi(rawTitle) {
        page.err = ""; page.aiInfo = ""; page.aiBusy = true
        Api.suggest(rawTitle)
    }

    ColumnLayout {
        width: Math.min(page.availableWidth - 48, 720)
        anchors.horizontalCenter: parent.horizontalCenter
        y: 32
        spacing: 16

        Text { text: "写给未来的信"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs4xl; font.bold: true }
        Text { Layout.fillWidth: true; wrapMode: Text.WordWrap; text: "这段文字会被上锁，直到你设定的时刻才能由任何人（包括你自己）开启。"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase }

        // 标题 + AI
        RowLayout {
            Text { text: "标题"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.Medium }
            Text { text: "· 最多 60 字"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
        }
        RowLayout {
            Layout.fillWidth: true; spacing: 8
            TextField {
                id: titleField
                Layout.fillWidth: true
                maximumLength: 60
                placeholderText: "给这枚胶囊起个名字"; placeholderTextColor: c.textDisabled
                color: c.textPrimary; font.pixelSize: Theme.sizes.fsBase
                background: Rectangle { radius: Theme.sizes.radiusMd; color: c.surface3; border.width: 1; border.color: parent.activeFocus ? c.signalPrimary : c.borderDefault }
            }
            HtButton {
                text: page.aiBusy ? "生成中…" : (page.aiGenerated ? "✨ 重新生成" : "✨ AI 生成")
                variant: "ghost"; loading: page.aiBusy; enabled: !page.aiBusy
                onClicked: page.runAi(titleField.text)
            }
        }
        Text { visible: page.aiInfo !== ""; text: page.aiInfo; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }

        RecommendationStrip {
            Layout.fillWidth: true
            visible: titleField.text.trim().length === 0 && page.recos.length > 0
            recos: page.recos; busy: page.recoBusy; disabled: page.aiBusy
            onPick: (r) => { titleField.text = r.title; contentField.text = ""; page.aiGenerated = false; page.runAi(r.title) }
            onRefresh: { page.recoBusy = true; Api.recommendations(4) }
        }

        // 正文
        RowLayout {
            Text { text: "内容"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.Medium }
            Text { text: "· 最多 5000 字"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
        }
        Rectangle {
            Layout.fillWidth: true; implicitHeight: 200
            radius: Theme.sizes.radiusMd; color: c.surface3
            border.width: 1; border.color: contentField.activeFocus ? c.signalPrimary : c.borderDefault
            ScrollView {
                anchors.fill: parent; anchors.margins: 8
                TextArea {
                    id: contentField
                    wrapMode: TextArea.Wrap
                    placeholderText: "在这里写下你想传递到未来的话…"; placeholderTextColor: c.textDisabled
                    color: c.textPrimary; font.pixelSize: Theme.sizes.fsBase
                    background: null
                    onTextChanged: if (length > 5000) remove(5000, length)
                }
            }
        }
        Text { Layout.alignment: Qt.AlignRight; text: contentField.length + " / 5000"; color: c.textDisabled; font.pixelSize: Theme.sizes.fsXs }

        // 开启时间
        RowLayout {
            Text { text: "开启时间"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.Medium }
            Text { text: "· 最早 60 秒后"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
        }
        DateTimePicker {
            Layout.fillWidth: true
            value: page.openAt
            onChanged: (d) => page.openAt = d
        }
        Flow {
            Layout.fillWidth: true; spacing: 8
            Text { text: "快速预设"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.Medium; anchors.verticalCenter: parent.verticalCenter }
            HtButton { text: "1 分钟后（测试）"; variant: "ghost"; size: "sm"; onClicked: page.openAt = new Date(Date.now() + 130000) }
            HtButton { text: "1 小时后"; variant: "ghost"; size: "sm"; onClicked: page.openAt = new Date(Date.now() + 3600000) }
            HtButton { text: "明天 9:00"; variant: "ghost"; size: "sm"; onClicked: { var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); page.openAt = d } }
            HtButton { text: "1 年后"; variant: "ghost"; size: "sm"; onClicked: { var d = new Date(); d.setFullYear(d.getFullYear() + 1); page.openAt = d } }
            HtButton { text: "2030.01.01"; variant: "ghost"; size: "sm"; onClicked: page.openAt = new Date(2030, 0, 1) }
        }

        HtAlert { Layout.fillWidth: true; variant: "info"; text: "上锁后不可编辑、不可提前开启；可以在「我创建的」列表里随时撤回（删除）。" }
        HtAlert { Layout.fillWidth: true; visible: page.err !== ""; variant: "danger"; text: page.err }

        // 底部操作栏
        RowLayout {
            Layout.fillWidth: true; Layout.bottomMargin: 32
            Switch { checked: page.inPlaza; onToggled: page.inPlaza = checked }
            Text { text: "发布到胶囊广场"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase }
            Item { Layout.fillWidth: true }
            HtButton { text: "取消"; variant: "ghost"; onClicked: ApplicationWindow.window.go("plaza") }
            HtButton {
                text: page.busy ? "封存中…" : "🔒 上锁封存"; variant: "primary"; size: "lg"
                loading: page.busy; enabled: !page.busy && page.canSubmit
                onClicked: { page.busy = true; page.err = ""; Api.createCapsule(titleField.text.trim(), contentField.text, Fmt.isoFromLocal(page.openAt), page.inPlaza) }
            }
        }
    }
}
