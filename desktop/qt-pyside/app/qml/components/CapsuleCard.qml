// 胶囊卡片：渐变描边（双层）+ 状态辉光 + hover 上浮呼吸；未开启每秒倒计时。
// = React CapsuleCard.tsx / Flutter capsule_card.dart。
import QtQuick
import QtQuick.Effects
import "../fmt.js" as Fmt

Item {
    id: root
    property var capsule: ({})
    property bool showCreator: true
    property bool hideFavorite: false
    // 右下角自定义槽：传入一个 Component（me-created 用撤回按钮）
    property Component rightSlot: null

    readonly property var c: Theme.colors
    readonly property bool opened: capsule.isOpened === true
    readonly property color accent: opened ? c.capsuleOpenedAccent : c.capsuleSealedAccent
    readonly property var gradStops: opened ? Theme.gradients.mintFlow : Theme.gradients.cyberFlow
    readonly property color glow: opened ? c.capsuleOpenedGlow : c.capsuleSealedGlow

    property real nowMs: Date.now()
    Timer { running: !root.opened; interval: 1000; repeat: true; onTriggered: root.nowMs = Date.now() }
    readonly property var cd: Fmt.countdownTo(capsule.openAt, nowMs)

    implicitHeight: 190
    scale: hoverArea.containsMouse ? 1.015 : 1.0
    y: hoverArea.containsMouse ? -2 : 0
    Behavior on scale { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
    Behavior on y { NumberAnimation { duration: 160 } }

    // 渐变描边层
    Rectangle {
        id: borderLayer
        anchors.fill: parent
        radius: Theme.sizes.radiusLg
        gradient: Gradient {
            orientation: Gradient.Vertical
            GradientStop { position: 0.0; color: root.gradStops[0] }
            GradientStop { position: 0.5; color: root.gradStops[1] }
            GradientStop { position: 1.0; color: root.gradStops[2] }
        }
        layer.enabled: true
        layer.effect: MultiEffect {
            shadowEnabled: true
            shadowColor: root.glow
            shadowBlur: hoverArea.containsMouse ? 1.0 : 0.6
            shadowScale: 1.0
            autoPaddingEnabled: true
        }
    }
    // 内层表面（露出 1.5px 渐变边）
    Rectangle {
        anchors.fill: parent
        anchors.margins: 1.5
        radius: Theme.sizes.radiusLg - 1.5
        color: c.surface1
    }

    // 内容
    Column {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 12

        Row {
            width: parent.width
            Badge { label: root.opened ? "已开启" : "未开启"; accent: root.accent }
            Item { width: parent.width - x - codeText.width; height: 1 }
            Text {
                id: codeText
                text: root.capsule.code || ""
                color: c.textLink; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.DemiBold
                anchors.verticalCenter: parent.verticalCenter
                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: ApplicationWindow.window.push("detail", { code: root.capsule.code }) }
            }
        }

        Text {
            width: parent.width
            text: root.capsule.title || ""
            color: c.textPrimary; font.pixelSize: Theme.sizes.fsLg; font.weight: Font.DemiBold
            maximumLineCount: 2; wrapMode: Text.WordWrap; elide: Text.ElideRight
            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: ApplicationWindow.window.push("detail", { code: root.capsule.code }) }
        }

        Text {
            width: parent.width
            visible: !root.opened
            text: "⏳ 还剩 " + root.cd.days + " 天 · " + Fmt.pad2(root.cd.hours) + ":" + Fmt.pad2(root.cd.minutes) + ":" + Fmt.pad2(root.cd.seconds)
            color: root.accent; font.pixelSize: Theme.sizes.fsSm; font.weight: Font.Medium
        }
        Text {
            width: parent.width
            visible: root.opened && !!root.capsule.contentPreview
            text: root.capsule.contentPreview || ""
            color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm
            maximumLineCount: 2; wrapMode: Text.WordWrap; elide: Text.ElideRight
        }
    }

    // 底部 meta（绝对定位在底部）
    Item {
        anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
        anchors.margins: 20
        height: 24
        Row {
            anchors.left: parent.left; anchors.verticalCenter: parent.verticalCenter
            spacing: 6
            visible: root.showCreator
            Avatar { avatarId: root.capsule.creator ? root.capsule.creator.avatarId : ""; nickname: root.capsule.creator ? root.capsule.creator.nickname : ""; size: 22; anchors.verticalCenter: parent.verticalCenter }
            Text { anchors.verticalCenter: parent.verticalCenter; text: root.capsule.creator ? root.capsule.creator.nickname : ""; color: c.textSecondary; font.pixelSize: Theme.sizes.fsSm }
        }
        Text {
            anchors.left: parent.left; anchors.verticalCenter: parent.verticalCenter
            visible: !root.showCreator
            text: "创建于 " + Fmt.fmtDate(root.capsule.createdAt)
            color: c.textMuted; font.pixelSize: Theme.sizes.fsSm
        }
        // 右下：自定义槽 或 收藏
        Loader {
            anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter
            active: !!root.rightSlot
            sourceComponent: root.rightSlot
        }
        FavoriteButton {
            anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter
            visible: !root.rightSlot && !root.hideFavorite
            capsuleId: root.capsule.id || ""
            favoritedByMe: root.capsule.favoritedByMe === true
            favoriteCount: root.capsule.favoriteCount || 0
        }
    }

    MouseArea { id: hoverArea; anchors.fill: parent; hoverEnabled: true; acceptedButtons: Qt.NoButton }
}
