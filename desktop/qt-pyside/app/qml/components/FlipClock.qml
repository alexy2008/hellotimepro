// 翻页时钟倒计时：天/时/分/秒 四格 + 冒号分隔（= SwiftUI FlipUnit / Flutter FlipClock）。
import QtQuick

Row {
    id: root
    property int days: 0
    property int hours: 0
    property int minutes: 0
    property int seconds: 0
    property color accent: Theme.colors.capsuleSealedAccent
    spacing: 6

    function pad2(n) { return ("" + n).padStart(2, "0"); }

    component Unit: Column {
        property int value: 0
        property string label: ""
        spacing: 8
        Rectangle {
            width: 64; height: 60; radius: Theme.sizes.radiusMd
            color: Theme.colors.surface2
            border.width: 1; border.color: Theme.colors.borderSubtle
            Text {
                anchors.centerIn: parent
                text: root.pad2(value)
                color: root.accent
                font.pixelSize: Theme.sizes.fs4xl; font.bold: true
                font.family: "Menlo"
            }
        }
        Text { anchors.horizontalCenter: parent.horizontalCenter; text: label; color: Theme.colors.textMuted; font.pixelSize: Theme.sizes.fsXs }
    }
    component Sep: Text {
        text: ":"; color: Theme.colors.textMuted; font.pixelSize: Theme.sizes.fs3xl; font.bold: true; topPadding: 14
    }

    Unit { value: root.days; label: "天" }
    Sep {}
    Unit { value: root.hours; label: "时" }
    Sep {}
    Unit { value: root.minutes; label: "分" }
    Sep {}
    Unit { value: root.seconds; label: "秒" }
}
