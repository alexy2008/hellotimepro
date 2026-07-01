// 广场工具栏：排序/过滤分段控件 + 300ms 防抖搜索（= React PlazaToolbar.tsx）。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

RowLayout {
    id: root
    readonly property var c: Theme.colors
    spacing: 16

    Flow {
        Layout.fillWidth: true
        spacing: 16
        Segmented { options: [["hot", "🔥 热门"], ["new", "✨ 最新"]]; current: Plaza.sort; onPick: (k) => Plaza.setSort(k) }
        Segmented { options: [["all", "全部"], ["opened", "已开启"], ["unopened", "未开启"]]; current: Plaza.filter; onPick: (k) => Plaza.setFilter(k) }
    }

    Rectangle {
        Layout.preferredWidth: 240
        height: 38
        radius: Theme.sizes.radiusMd
        color: c.surface3
        border.width: 1; border.color: searchField.activeFocus ? c.signalPrimary : c.borderDefault
        Row {
            anchors.fill: parent; anchors.leftMargin: 12; spacing: 6
            Text { text: "🔍"; anchors.verticalCenter: parent.verticalCenter; color: c.textMuted }
            TextField {
                id: searchField
                width: parent.width - 30
                anchors.verticalCenter: parent.verticalCenter
                placeholderText: "搜索标题或昵称…"
                placeholderTextColor: c.textDisabled
                color: c.textPrimary
                font.pixelSize: Theme.sizes.fsSm
                maximumLength: 50
                background: null
                onTextChanged: debounce.restart()
                Timer { id: debounce; interval: 300; onTriggered: Plaza.setQ(searchField.text) }
            }
        }
    }
}
