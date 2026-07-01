// 关于页：产品简介 + 桌面端技术栈（Qt/PySide）+ 后端技术栈（from health）+ 元信息。
// = React AboutPage.tsx / Flutter about_page.dart。
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../components"

ScrollView {
    id: page
    property string route: "about"
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    readonly property var c: Theme.colors

    property var health: null
    readonly property var desktopStack: [
        { name: "Qt Quick", version: "6", icon: "/static/icons/qt.svg" },
        { name: "PySide6", version: "6", icon: "/static/icons/python.svg" }
    ]
    readonly property string desktopSummary:
        "本页运行在纯原生 Qt Quick/QML + PySide6 桌面端：视图层用声明式 QML 重建，业务逻辑/状态用 Python（QObject store 经 context property 暴露给 QML）。" +
        "HTTP 直连反代 :9080，复用同一套 /api/v1 契约——桌面壳本身不持有 API。" +
        "与之对照：electron/tauri 是 Web 壳内嵌前端，swiftui 是 macOS 系统原生，flutter 是 Dart 自绘引擎。" +
        "Qt 的看点是「成熟 C++ 引擎 + 脚本语言（Python）逻辑 + QML 声明式标记」这一经典组合，且一套代码跨 Linux/mac/Win。"

    Component.onCompleted: Api.health()
    Connections { target: Api; function onHealthReady(h) { page.health = h } }

    ColumnLayout {
        width: Math.min(page.availableWidth - 48, 720)
        anchors.horizontalCenter: parent.horizontalCenter
        y: 48
        spacing: 16

        RowLayout {
            spacing: 0
            Text { text: "关于 "; color: c.textPrimary; font.pixelSize: Theme.sizes.fs5xl; font.bold: true }
            Text { text: "HelloTime Pro"; color: Theme.gradients.brandHero[1]; font.pixelSize: Theme.sizes.fs5xl; font.bold: true }
        }
        Text {
            Layout.fillWidth: true; wrapMode: Text.WordWrap
            text: "一款时光胶囊应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。支持胶囊广场浏览、AI 辅助创作、收藏与账户管理。同时也是一个多技术栈对比学习项目，同一份产品需求由多套前后端框架各自实现，共享同一份 API 契约、数据库 schema 与设计 token。"
            color: c.textSecondary; font.pixelSize: Theme.sizes.fsLg; lineHeight: 1.6
        }

        // 桌面端技术栈
        Text { Layout.topMargin: 16; text: "桌面端技术栈"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs2xl; font.bold: true }
        StackCard { items: page.desktopStack; summary: page.desktopSummary }

        // 后端技术栈
        Text { Layout.topMargin: 16; visible: !!page.health; text: "后端技术栈"; color: c.textPrimary; font.pixelSize: Theme.sizes.fs2xl; font.bold: true }
        StackCard { visible: !!page.health; items: page.health ? page.health.stack.items : []; summary: page.health ? page.health.stack.summary : "" }

        // 元信息
        Rectangle {
            Layout.fillWidth: true; Layout.topMargin: 16; implicitHeight: 48; color: "transparent"
            Rectangle { width: parent.width; height: 1; anchors.top: parent.top; color: c.borderSubtle }
            Row {
                anchors.verticalCenter: parent.verticalCenter; spacing: 24
                Text { text: "桌面端：Qt Quick + PySide6"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                Text { text: "后端：" + (page.health ? backendFw() : "—"); color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
                Text { text: "License: MIT"; color: c.textMuted; font.pixelSize: Theme.sizes.fsSm }
            }
        }
    }

    function backendFw() {
        if (!health) return "—"
        for (var i = 0; i < health.stack.items.length; i++) if (health.stack.items[i].role === "framework") return health.stack.items[i].name
        return "—"
    }

    // 技术栈卡片
    component StackCard: Rectangle {
        id: cardRoot
        property var items: []
        property string summary: ""
        Layout.fillWidth: true
        implicitHeight: cardCol.implicitHeight + 48
        radius: Theme.sizes.radiusLg; color: Theme.colors.surface1; border.width: 1; border.color: Theme.colors.borderSubtle
        ColumnLayout {
            id: cardCol
            anchors.fill: parent; anchors.margins: 24; spacing: 16
            Flow {
                Layout.fillWidth: true; spacing: 24
                Repeater {
                    model: cardRoot.items
                    delegate: Column {
                        required property var modelData
                        spacing: 4
                        Image { source: (modelData.icon || modelData.iconUrl) ? Api.resolveAsset(modelData.icon || modelData.iconUrl) : ""; sourceSize.width: 40; sourceSize.height: 40; width: 40; height: 40; anchors.horizontalCenter: parent.horizontalCenter }
                        Text { anchors.horizontalCenter: parent.horizontalCenter; text: modelData.name + (modelData.version ? " " + modelData.version : ""); color: Theme.colors.textMuted; font.pixelSize: Theme.sizes.fsXs; font.family: "Menlo" }
                    }
                }
            }
            Text { Layout.fillWidth: true; wrapMode: Text.WordWrap; text: cardRoot.summary; color: Theme.colors.textSecondary; font.pixelSize: Theme.sizes.fsBase; lineHeight: 1.6 }
        }
    }
}
