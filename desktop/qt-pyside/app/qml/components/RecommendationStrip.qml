// 创建页「AI 推荐灵感」条：标签轮换三色描边 + 换一批（= React RecommendationStrip.tsx）。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ColumnLayout {
    id: root
    property var recos: []
    property bool busy: false
    property bool disabled: false
    signal pick(var reco)
    signal refresh()
    readonly property var c: Theme.colors
    spacing: 8

    RowLayout {
        Layout.fillWidth: true
        Text { text: "✨ 没有头绪？试试这些灵感"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.Medium }
        Item { Layout.fillWidth: true }
        Button {
            flat: true
            enabled: !root.busy && !root.disabled
            onClicked: root.refresh()
            contentItem: Text { text: root.busy ? "换一批中…" : "换一批"; color: c.textLink; font.pixelSize: Theme.sizes.fsSm }
            background: null
        }
    }
    Flow {
        Layout.fillWidth: true; spacing: 8
        Repeater {
            model: root.recos
            delegate: Button {
                required property var modelData
                required property int index
                readonly property var palette: [root.c.brandPrimary, root.c.accentPrimary, root.c.signalPrimary]
                enabled: !root.busy && !root.disabled
                hoverEnabled: true
                ToolTip.visible: hovered; ToolTip.text: modelData.hint
                onClicked: root.pick(modelData)
                contentItem: Text { text: modelData.title; color: root.c.textPrimary; font.pixelSize: Theme.sizes.fsSm }
                leftPadding: 12; rightPadding: 12; topPadding: 6; bottomPadding: 6
                background: Rectangle { radius: height / 2; color: "transparent"; border.width: 1; border.color: palette[index % 3] }
            }
        }
    }
}
