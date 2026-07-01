// 404（= React NotFoundPage.tsx）。
import QtQuick
import QtQuick.Layouts
import "../components"

Item {
    property string route: "not-found"
    readonly property var c: Theme.colors
    ColumnLayout {
        anchors.centerIn: parent
        spacing: 12
        Text { Layout.alignment: Qt.AlignHCenter; text: "🛰️"; font.pixelSize: 56 }
        Text { Layout.alignment: Qt.AlignHCenter; text: "404 · 这里什么都没有"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs2xl; font.bold: true }
        Text { Layout.alignment: Qt.AlignHCenter; text: "页面可能已被封存，或链接有误。"; color: c.textSecondary; font.pixelSize: Theme.sizes.fsBase }
        HtButton { Layout.alignment: Qt.AlignHCenter; text: "回广场"; variant: "primary"; onClicked: ApplicationWindow.window.go("plaza") }
    }
}
