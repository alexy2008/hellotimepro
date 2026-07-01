// 我创建的：列表（撤回/已开收藏数）+ 分页。= React MeCreatedPage.tsx。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"

ScrollView {
    id: page
    property string route: "me-created"
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    readonly property var c: Theme.colors

    Component.onCompleted: Capsules.fetchMine(1)

    RowLayout {
        width: Math.min(page.availableWidth - 48, 1180)
        anchors.horizontalCenter: parent.horizontalCenter
        y: 32
        spacing: 32

        MeSidebar { Layout.preferredWidth: 200; Layout.alignment: Qt.AlignTop; current: "me-created" }

        ColumnLayout {
            Layout.fillWidth: true; Layout.alignment: Qt.AlignTop; spacing: 16
            Text { text: "我创建的胶囊"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs2xl; font.bold: true }
            RowLayout {
                Layout.fillWidth: true
                Text { text: "按创建时间倒序 · 共 " + Capsules.mineTotal + " 条"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                Item { Layout.fillWidth: true }
                HtButton { text: "+ 新建胶囊"; variant: "primary"; size: "sm"; onClicked: ApplicationWindow.window.go("create") }
            }
            GridLayout {
                Layout.fillWidth: true
                columns: Math.max(1, Math.floor((width + 16) / (340 + 16)))
                columnSpacing: 16; rowSpacing: 16
                visible: Capsules.mineItems.length > 0
                Repeater {
                    model: Capsules.mineItems
                    delegate: CapsuleCard {
                        required property var modelData
                        Layout.fillWidth: true; Layout.preferredHeight: 190
                        capsule: modelData
                        showCreator: false; hideFavorite: true
                        rightSlot: modelData.isOpened ? openedSlot : withdrawSlot
                        property Component openedSlot: Component { Row { spacing: 4; Text { text: "♥"; color: Theme.colors.favoriteActive; font.pixelSize: 14 } Text { text: "" + modelData.favoriteCount; color: Theme.colors.textMuted; font.pixelSize: Theme.sizes.fsSm } } }
                        property Component withdrawSlot: Component { HtButton { text: "撤回"; variant: "danger"; size: "sm"; onClicked: confirmDel.openFor(modelData.id) } }
                    }
                }
            }
            ColumnLayout {
                Layout.fillWidth: true; Layout.topMargin: 48
                visible: Capsules.mineItems.length === 0 && !Capsules.mineLoading
                Text { Layout.alignment: Qt.AlignHCenter; text: "📭"; font.pixelSize: 40 }
                Text { Layout.alignment: Qt.AlignHCenter; text: "还没有创建任何胶囊"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase }
                HtButton { Layout.alignment: Qt.AlignHCenter; text: "去创建一个"; variant: "primary"; size: "sm"; onClicked: ApplicationWindow.window.go("create") }
            }
            Pagination { Layout.fillWidth: true; page: Capsules.minePage; totalPages: Capsules.mineTotalPages; total: Capsules.mineTotal; onChange: (p) => Capsules.fetchMine(p) }
        }
    }

    Dialog {
        id: confirmDel
        property string targetId: ""
        function openFor(id) { targetId = id; open() }
        modal: true; anchors.centerIn: Overlay.overlay
        title: "确认撤回？"; standardButtons: Dialog.Ok | Dialog.Cancel
        onAccepted: Capsules.deleteCapsule(targetId)
        Label { text: "此操作不可恢复。" }
    }
}
