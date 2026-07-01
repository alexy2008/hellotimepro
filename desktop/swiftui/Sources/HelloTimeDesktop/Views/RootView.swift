// 根布局：顶部 Header + 路由内容区 + 底部 Footer。顶层挂全局 banner。
// 匿名可用：广场 / 开启 / 关于 / 凭码详情 对未登录开放；创建 / 我的 需登录。

import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        @Bindable var store = store
        VStack(spacing: 0) {
            AppHeader()
            Divider().overlay(Theme.borderSubtle)
            content
            Divider().overlay(Theme.borderSubtle)
            AppFooter()
        }
        .background(Theme.surface0)
        .tint(Theme.brandPrimary)
        .overlay(alignment: .top) {
            if let banner = store.banner {
                BannerView(text: banner) { store.banner = nil }
                    .padding(.top, Space.s4)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: store.banner)
    }

    @ViewBuilder
    private var content: some View {
        ScrollView {
            Group {
                switch store.current {
                case .plaza:       PlazaView()
                case .open:        OpenView()
                case .about:       AboutView()
                case .create:      CreateView()
                case .login:       LoginView()
                case .register:    RegisterView()
                case .meCreated, .meFavorites, .meProfile: MeView()
                case .capsule(let code): CapsuleDetailView(code: code)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.surface0)
    }
}

/// 居中容器（对齐 cy-container / cy-container--narrow）。
struct Container<Content: View>: View {
    var maxWidth: CGFloat = Layout.containerMax
    @ViewBuilder var content: () -> Content
    var body: some View {
        content()
            .frame(maxWidth: maxWidth, alignment: .leading)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Space.s6)
    }
}

struct BannerView: View {
    let text: String
    let onClose: () -> Void
    var body: some View {
        HStack(spacing: Space.s3) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.warningFg)
            Text(text).font(.system(size: FontSize.sm, weight: .medium)).foregroundStyle(Theme.textPrimary)
            Spacer(minLength: Space.s4)
            Button(action: onClose) { Image(systemName: "xmark").font(.system(size: FontSize.xs, weight: .bold)).foregroundStyle(Theme.textMuted) }
                .buttonStyle(.plain)
        }
        .padding(.vertical, Space.s3).padding(.horizontal, Space.s4)
        .background(.regularMaterial)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Theme.borderDefault, lineWidth: 1))
        .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
        .frame(maxWidth: 520)
    }
}
