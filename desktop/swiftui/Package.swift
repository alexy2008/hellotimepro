// swift-tools-version:6.0
// HelloTime Pro · SwiftUI 原生 macOS 桌面端
//
// 与 desktop/electron · desktop/tauri 的根本区别：本实现 **零 webview、零内嵌 SPA**，
// 整套 UI 用 SwiftUI 声明式重建。是「桌面选择题」从「Web 壳」到「纯原生」的转折点，
// 与 backends/vapor（Swift 后端）呼应。
//
// 形态：纯 SwiftPM 可执行包（不用 .xcodeproj），与仓库 CLI 驱动风格一致，
// 呼应 backends/vapor 的 SwiftPM 做法。`swift build` / `swift run` 即可，无需 Xcode GUI。
//
// 语言模式取 v5：Swift 6 严格并发对教学示例是过度的仪式开销，
// 关键状态仍以 @MainActor 标注，保持线程正确性。
import PackageDescription

let package = Package(
    name: "HelloTimeDesktop",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "HelloTimeDesktop",
            path: "Sources/HelloTimeDesktop",
            swiftSettings: [.swiftLanguageMode(.v5)]
        )
    ]
)
