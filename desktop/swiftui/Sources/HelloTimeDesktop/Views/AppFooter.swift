// 底部页脚：版权 + 后端在线指示点 + 技术栈（桌面端 SwiftUI/Swift + 后端 from health）。

import SwiftUI

/// 桌面端原生技术栈（对照 React 页脚的 Electron+Node / 前端三件套）。
private let DESKTOP_STACK: [(role: String, name: String, icon: String)] = [
    ("desktop", "SwiftUI", "/static/icons/swiftui.svg"),
    ("language", "Swift 6", "/static/icons/swift.svg"),
]

struct AppFooter: View {
    @Environment(AppStore.self) private var store
    @State private var health: HealthData?
    @State private var connected: Bool?

    var body: some View {
        Container {
            HStack(spacing: Space.s4) {
                HStack(spacing: Space.s2) {
                    Text("© 2026 HelloTime Pro").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
                    Circle().fill(dotColor).frame(width: 8, height: 8)
                        .help(connected == true ? "后端在线" : connected == false ? "后端离线" : "连接中…")
                }
                Spacer()
                stack
            }
        }
        .frame(height: Layout.headerHeight)
        .task { await loadHealth() }
    }

    private var dotColor: Color {
        switch connected { case .some(true): Theme.successSolid; case .some(false): Theme.dangerSolid; default: Theme.textDisabled }
    }

    private var stack: some View {
        HStack(spacing: Space.s4) {
            ForEach(DESKTOP_STACK, id: \.name) { it in stackItem(name: it.name, icon: it.icon) }
            ForEach(health?.stack.items ?? []) { it in stackItem(name: it.name, icon: it.iconUrl) }
        }
    }

    private func stackItem(name: String, icon: String?) -> some View {
        HStack(spacing: Space.s1) {
            if let icon, let url = store.api.resolveAsset(icon) {
                RemoteSVGImage(url: url) { Color.clear }.frame(width: 16, height: 16)
            }
            Text(name).font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted)
        }
    }

    private func loadHealth() async {
        do { health = try await store.api.health(); connected = true }
        catch { connected = false }
    }
}
