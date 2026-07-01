// 收藏按钮（sm 角标 / md 详情按钮）。匿名→确认跳登录；否则切换并经 Capsules.favoriteChanged 同步。
// = React FavoriteButton.tsx / Flutter favorite_button.dart。
import QtQuick
import QtQuick.Controls

Item {
    id: root
    property string capsuleId: ""
    property bool favoritedByMe: false
    property int favoriteCount: 0
    property string size: "sm"   // sm|md

    property bool active: favoritedByMe
    property int count: favoriteCount
    onFavoritedByMeChanged: active = favoritedByMe
    onFavoriteCountChanged: count = favoriteCount

    readonly property var c: Theme.colors
    implicitWidth: row.implicitWidth + (size === "md" ? 24 : 12)
    implicitHeight: size === "md" ? 36 : 26

    Connections {
        target: Capsules
        function onFavoriteChanged(id, fav, cnt) {
            if (id === root.capsuleId) { root.active = fav; root.count = cnt }
        }
    }

    Rectangle {
        anchors.fill: parent
        radius: root.size === "md" ? Theme.sizes.radiusMd : height / 2
        color: "transparent"
        border.width: root.size === "md" ? 1 : 0
        border.color: c.borderDefault
    }

    Row {
        id: row
        anchors.centerIn: parent
        spacing: 4
        Text {
            anchors.verticalCenter: parent.verticalCenter
            text: root.active ? "♥" : "♡"
            color: root.active ? c.favoriteActive : c.favoriteInactive
            font.pixelSize: root.size === "md" ? 18 : 15
        }
        Text {
            anchors.verticalCenter: parent.verticalCenter
            text: root.size === "md" ? ("收藏 · " + root.count) : ("" + root.count)
            color: root.size === "md" ? c.textPrimary : c.textMuted
            font.pixelSize: Theme.sizes.fsSm
        }
    }

    MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        onClicked: {
            if (!Auth.isAuthenticated) { confirm.open(); return }
            Capsules.toggleFavorite(root.capsuleId, root.active)
        }
    }

    Dialog {
        id: confirm
        modal: true
        anchors.centerIn: Overlay.overlay
        title: "登录后才能收藏"
        standardButtons: Dialog.Ok | Dialog.Cancel
        onAccepted: ApplicationWindow.window.go("login")
        Label { text: "前往登录？" }
    }
}
