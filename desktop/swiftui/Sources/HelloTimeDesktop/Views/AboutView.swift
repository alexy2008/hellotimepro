// 关于页：产品简介 + 桌面端原生技术栈 + 后端技术栈（from health）。
// 对齐 React AboutPage，但「前端栈」换成「SwiftUI 桌面端栈」。

import SwiftUI

private let DESKTOP_STACK: [(name: String, version: String, icon: String)] = [
    ("SwiftUI", "macOS 14+", "/static/icons/swiftui.svg"),
    ("Swift", "6", "/static/icons/swift.svg"),
]

private let DESKTOP_SUMMARY =
    "本应用是 HelloTime Pro 的原生 macOS 桌面端：用 SwiftUI 声明式重建整套界面，零 webview、" +
    "零内嵌网页 —— 与 Electron（自带 Chromium）/ Tauri（系统 WebView 内嵌前端）走的是完全不同的路。" +
    "URLSession 直连同一套 /api/v1 契约（默认指向 :9080 反向代理），不持有任何后端逻辑。" +
    "数据层用 Swift Concurrency（async/await）、状态用 Observation 框架（@Observable），" +
    "视觉取系统 SF 字体与材质模糊，原生质感与平台一致。"

struct AboutView: View {
    @Environment(AppStore.self) private var store
    @State private var health: HealthData?
    @State private var err: String?

    var body: some View {
        Container(maxWidth: Layout.containerNarrow) {
            VStack(alignment: .leading, spacing: Space.s10) {
                VStack(alignment: .leading, spacing: Space.s3) {
                    (Text("关于 ").foregroundStyle(Theme.textPrimary)
                        + Text("HelloTime Pro").foregroundStyle(Theme.brandPrimary))
                        .font(.display(FontSize.display))
                    Text("一款时光胶囊应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。支持广场浏览、AI 辅助创作、收藏与账户管理。同时是一个多技术栈对比学习项目：同一份产品需求由多套前后端框架各自实现，共享同一份 API 契约、数据库 schema 与设计 token。")
                        .font(.system(size: FontSize.lg)).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                stackSection(title: "桌面端技术栈", items: DESKTOP_STACK.map { ($0.name, $0.version, $0.icon) }, summary: DESKTOP_SUMMARY)

                if let err { HTAlert(variant: .danger, text: "无法读取后端信息：\(err)") }
                if let health {
                    stackSection(title: "后端技术栈",
                                 items: health.stack.items.map { ($0.name, $0.version, $0.iconUrl ?? "") },
                                 summary: health.stack.summary)
                }

                HStack(spacing: Space.s6) {
                    metaItem("桌面端", "SwiftUI / Swift")
                    metaItem("后端", health?.stack.items.first(where: { $0.role == "framework" })?.name ?? "—")
                    metaItem("License", "MIT")
                }
                .padding(.top, Space.s4)
                .overlay(alignment: .top) { Divider().overlay(Theme.borderSubtle) }
            }
            .padding(.vertical, Space.s12)
        }
        .task {
            do { health = try await store.api.health() } catch { err = (error as? LocalizedError)?.errorDescription ?? "连接失败" }
        }
    }

    private func stackSection(title: String, items: [(String, String, String)], summary: String) -> some View {
        VStack(alignment: .leading, spacing: Space.s5) {
            Text(title).font(.display(FontSize.xxl)).foregroundStyle(Theme.textPrimary)
            VStack(alignment: .leading, spacing: Space.s5) {
                HStack(spacing: Space.s6) {
                    ForEach(items, id: \.0) { (name, version, icon) in
                        VStack(spacing: Space.s1) {
                            if let url = store.api.resolveAsset(icon), !icon.isEmpty {
                                RemoteSVGImage(url: url) { Color.clear }.frame(width: 44, height: 44)
                            } else {
                                RoundedRectangle(cornerRadius: Radius.md).fill(Theme.surface2).frame(width: 44, height: 44)
                            }
                            Text("\(name)\(version.isEmpty ? "" : " \(version)")")
                                .font(.system(size: FontSize.xs, design: .monospaced)).foregroundStyle(Theme.textMuted)
                        }
                    }
                }
                Text(summary).font(.system(size: FontSize.base)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .cardStyle()
        }
    }

    private func metaItem(_ label: String, _ value: String) -> some View {
        HStack(spacing: Space.s1) {
            Text("\(label)：").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
            Text(value).font(.system(size: FontSize.sm, design: .monospaced)).foregroundStyle(Theme.textSecondary)
        }
    }
}
