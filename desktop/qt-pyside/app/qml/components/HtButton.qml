// 按钮：变体 × 尺寸（对齐 cyber.css）。primary=信号青 / success=薄荷绿 / ghost=描边 /
// hero*=流光渐变 / danger=红字。= React cy-btn / Flutter HtButton。
import QtQuick
import QtQuick.Controls

Button {
    id: ctl
    property string variant: "primary"   // primary|ghost|success|danger|heroPrimary|heroSuccess
    property string size: "md"           // sm|md|lg
    property bool loading: false
    readonly property var c: Theme.colors
    readonly property bool hero: variant === "heroPrimary" || variant === "heroSuccess"

    hoverEnabled: true
    font.pixelSize: hero ? Theme.sizes.fsLg : (size === "sm" ? Theme.sizes.fsSm : (size === "lg" ? Theme.sizes.fsLg : Theme.sizes.fsBase))
    font.bold: hero
    font.weight: hero ? Font.Bold : Font.DemiBold
    leftPadding: hero ? 32 : (size === "sm" ? 12 : (size === "lg" ? 24 : 18))
    rightPadding: leftPadding
    topPadding: hero ? 14 : (size === "sm" ? 6 : (size === "lg" ? 14 : 10))
    bottomPadding: topPadding
    opacity: enabled ? 1 : 0.5

    readonly property color fgColor: {
        if (variant === "primary") return c.signalOn
        if (variant === "success") return c.successOn
        if (hero) return "#ffffff"
        if (variant === "danger") return c.dangerFg
        return c.textPrimary
    }
    readonly property var heroStops: variant === "heroSuccess" ? Theme.gradients.successFlow : Theme.gradients.primaryFlow

    contentItem: Row {
        spacing: 6
        BusyIndicator { running: ctl.loading; visible: ctl.loading; implicitWidth: 16; implicitHeight: 16; anchors.verticalCenter: parent.verticalCenter }
        Text {
            text: ctl.text
            color: ctl.fgColor
            font: ctl.font
            anchors.verticalCenter: parent.verticalCenter
        }
    }

    background: Rectangle {
        radius: ctl.hero ? height / 2 : Theme.sizes.radiusMd
        border.width: ctl.variant === "ghost" ? 1 : 0
        border.color: ctl.c.borderDefault
        color: {
            if (ctl.hero) return "transparent"
            if (ctl.variant === "primary") return ctl.hovered ? ctl.c.signalHover : ctl.c.signalPrimary
            if (ctl.variant === "success") return ctl.c.successSolid
            if (ctl.variant === "ghost") return ctl.hovered ? ctl.c.surface2 : "transparent"
            if (ctl.variant === "danger") return ctl.hovered ? ctl.c.dangerBg : "transparent"
            return "transparent"
        }
        gradient: ctl.hero ? heroGrad : null
        Gradient {
            id: heroGrad
            orientation: Gradient.Horizontal
            GradientStop { position: 0.0; color: ctl.heroStops[0] }
            GradientStop { position: 0.5; color: ctl.heroStops[1] }
            GradientStop { position: 1.0; color: ctl.heroStops[2] }
        }
    }
}
