// 信息/成功/危险提示条（= cy-alert）。
import QtQuick

Rectangle {
    id: root
    property string variant: "info"   // info|success|danger
    property string text: ""
    readonly property var c: Theme.colors
    readonly property color fg: variant === "success" ? c.successFg : (variant === "danger" ? c.dangerFg : c.textLink)
    readonly property color bg: variant === "success" ? c.successBg : (variant === "danger" ? c.dangerBg : c.brandSubtle)

    implicitHeight: Math.max(44, label.implicitHeight + 24)
    radius: Theme.sizes.radiusMd
    color: Qt.rgba(bg.r, bg.g, bg.b, 0.5)
    border.width: 1
    border.color: Qt.rgba(fg.r, fg.g, fg.b, 0.3)

    Row {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 10
        Text {
            text: root.variant === "success" ? "✓" : (root.variant === "danger" ? "⚠" : "ⓘ")
            color: root.fg
            font.pixelSize: Theme.sizes.fsBase
        }
        Text {
            id: label
            width: root.width - 46
            text: root.text
            color: root.c.textSecondary
            font.pixelSize: Theme.sizes.fsSm
            wrapMode: Text.WordWrap
            lineHeight: 1.4
        }
    }
}
