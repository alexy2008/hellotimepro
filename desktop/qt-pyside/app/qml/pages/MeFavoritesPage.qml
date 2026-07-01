// 我收藏的：列表 + 分页。= React MeFavoritesPage.tsx。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"

ScrollView {
    id: page
    property string route: "me-favorites"
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    readonly property var c: Theme.colors

    Component.onCompleted: Capsules.fetchFavorites(1)

    RowLayout {
        width: Math.min(page.availableWidth - 48, 1180)
        anchors.horizontalCenter: parent.horizontalCenter
        y: 32
        spacing: 32

        MeSidebar { Layout.preferredWidth: 200; Layout.alignment: Qt.AlignTop; current: "me-favorites" }

        ColumnLayout {
            Layout.fillWidth: true; Layout.alignment: Qt.AlignTop; spacing: 16
            Text { text: "我收藏的胶囊"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs2xl; font.bold: true }
            Text { text: "共 " + Capsules.favTotal + " 条；取消收藏只会从此列表移除，不会影响原胶囊。"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
            GridLayout {
                Layout.fillWidth: true
                columns: Math.max(1, Math.floor((width + 16) / (340 + 16)))
                columnSpacing: 16; rowSpacing: 16
                visible: Capsules.favItems.length > 0
                Repeater {
                    model: Capsules.favItems
                    delegate: CapsuleCard { required property var modelData; Layout.fillWidth: true; Layout.preferredHeight: 190; capsule: modelData }
                }
            }
            ColumnLayout {
                Layout.fillWidth: true; Layout.topMargin: 48
                visible: Capsules.favItems.length === 0 && !Capsules.favLoading
                Text { Layout.alignment: Qt.AlignHCenter; text: "🗂"; font.pixelSize: 40 }
                Text { Layout.alignment: Qt.AlignHCenter; text: "还没有收藏任何胶囊 —— 去广场看看？"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase }
                HtButton { Layout.alignment: Qt.AlignHCenter; text: "去广场"; variant: "ghost"; size: "sm"; onClicked: ApplicationWindow.window.go("plaza") }
            }
            Pagination { Layout.fillWidth: true; page: Capsules.favPage; totalPages: Capsules.favTotalPages; total: Capsules.favTotal; onChange: (p) => Capsules.fetchFavorites(p) }
        }
    }
}
