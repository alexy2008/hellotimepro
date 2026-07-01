// 广场首页：hero（渐变标题 + 紫光 + 双 CTA）+ 工具栏 + 网格 + 分页。
// = React PlazaPage.tsx / Flutter plaza_page.dart。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"

ScrollView {
    id: page
    property string route: "plaza"
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

    readonly property var c: Theme.colors

    Component.onCompleted: if (Auth.hydrated) Plaza.fetch()

    ColumnLayout {
        width: page.availableWidth
        spacing: 0

        // Hero
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: heroCol.implicitHeight + 96
            color: c.surface0
            Rectangle {  // 居中紫光
                anchors.centerIn: parent
                width: 520; height: 200; radius: 120
                color: c.plazaGlow
                opacity: 0.45
            }
            ColumnLayout {
                id: heroCol
                anchors.centerIn: parent
                width: Math.min(parent.width - 48, 720)
                spacing: 16
                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    spacing: 0
                    Text { text: "封存此刻 "; color: c.textPrimary; font.pixelSize: Theme.sizes.fs5xl; font.bold: true }
                    Text {
                        text: "开启未来"; font.pixelSize: Theme.sizes.fs5xl; font.bold: true
                        color: Theme.gradients.brandHero[1]
                    }
                }
                Text {
                    Layout.fillWidth: true
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: "写下此刻最真实的想法，设定一个解封时刻——明年生日、十年后的清晨，或任何值得等待的瞬间。时间到了，它才会被打开。"
                    color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase; lineHeight: 1.5
                }
                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    spacing: 12
                    HtButton { text: "✨ 创建我的胶囊"; variant: "heroPrimary"; onClicked: ApplicationWindow.window.go(Auth.isAuthenticated ? "create" : "register") }
                    HtButton { text: "🔓 用胶囊码开启"; variant: "heroSuccess"; onClicked: ApplicationWindow.window.go("open") }
                }
            }
        }

        // 主体容器
        ColumnLayout {
            Layout.fillWidth: true
            Layout.maximumWidth: 1180
            Layout.alignment: Qt.AlignHCenter
            Layout.leftMargin: 24
            Layout.rightMargin: 24
            Layout.topMargin: 24
            Layout.bottomMargin: 32
            spacing: 16

            PlazaToolbar { Layout.fillWidth: true }

            GridLayout {
                Layout.fillWidth: true
                columns: Math.max(1, Math.floor((width + 16) / (340 + 16)))
                columnSpacing: 16
                rowSpacing: 16
                visible: Plaza.items.length > 0
                Repeater {
                    model: Plaza.items
                    delegate: CapsuleCard {
                        required property var modelData
                        Layout.fillWidth: true
                        Layout.preferredHeight: 190
                        capsule: modelData
                    }
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                Layout.topMargin: 48
                visible: Plaza.items.length === 0
                Text { Layout.alignment: Qt.AlignHCenter; text: Plaza.loading ? "⏳" : "🌌"; font.pixelSize: 40 }
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: Plaza.loading ? "加载中…" : "广场暂无胶囊 —— 来当第一个写信给未来的人？"
                    color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase
                }
                HtButton {
                    Layout.alignment: Qt.AlignHCenter
                    visible: !Plaza.loading
                    text: Auth.isAuthenticated ? "创建胶囊" : "注册并创建"; variant: "primary"; size: "sm"
                    onClicked: ApplicationWindow.window.go(Auth.isAuthenticated ? "create" : "register")
                }
            }

            Pagination {
                Layout.fillWidth: true
                page: Plaza.page; totalPages: Plaza.totalPages; total: Plaza.total
                onChange: (p) => Plaza.setPage(p)
            }
        }
    }
}
