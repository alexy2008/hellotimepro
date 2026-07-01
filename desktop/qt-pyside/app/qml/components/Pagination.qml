// 分页器：上一页 / 第 X / Y 页 · 共 N 条 / 下一页（= React Pagination.tsx）。
import QtQuick
import QtQuick.Layouts

RowLayout {
    id: root
    property int page: 1
    property int totalPages: 0
    property int total: 0
    property bool showTotal: true
    signal change(int p)
    visible: totalPages > 1
    spacing: 16

    Item { Layout.fillWidth: true }
    HtButton {
        text: "上一页"; variant: "ghost"; size: "sm"
        enabled: root.page > 1
        onClicked: root.change(root.page - 1)
    }
    Text {
        text: "第 " + root.page + " / " + root.totalPages + " 页" + (root.showTotal ? " · 共 " + root.total + " 条" : "")
        color: Theme.colors.textMuted; font.pixelSize: Theme.sizes.fsSm
        Layout.alignment: Qt.AlignVCenter
    }
    HtButton {
        text: "下一页"; variant: "ghost"; size: "sm"
        enabled: root.page < root.totalPages
        onClicked: root.change(root.page + 1)
    }
    Item { Layout.fillWidth: true }
}
