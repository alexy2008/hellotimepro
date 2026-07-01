// 顶部导航：品牌 + 广场/开启/关于 + 主题切换 + 用户菜单（或登录/注册）。

import SwiftUI

struct AppHeader: View {
    @Environment(AppStore.self) private var store
    @State private var menuOpen = false

    var body: some View {
        HStack(spacing: Space.s6) {
            Button { store.navigate(to: .plaza) } label: {
                HStack(spacing: Space.s2) {
                    LogoMark(size: 32)
                    Text("HelloTime").font(.display(FontSize.xl)).foregroundStyle(Theme.textPrimary)
                    Text("PRO").font(.display(FontSize.sm)).foregroundStyle(Theme.brandGradient)
                        .padding(.horizontal, Space.s2).padding(.vertical, 2)
                        .background(Theme.brandSubtle.opacity(0.5)).clipShape(Capsule())
                }
            }
            .buttonStyle(.plain)

            HStack(spacing: Space.s1) {
                navLink("广场", route: .plaza)
                navLink("开启", route: .open)
                navLink("关于", route: .about)
            }

            Spacer()

            Button { store.toggleTheme() } label: {
                Image(systemName: store.theme == .dark ? "moon.stars.fill" : "sun.max.fill")
                    .font(.system(size: FontSize.base))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: 34, height: 34)
                    .background(Theme.surface2).clipShape(Circle())
            }
            .buttonStyle(.plain)
            .help("切换主题")

            accountControl
        }
        .padding(.horizontal, Space.s6)
        .frame(height: Layout.headerHeight)
        .background(.ultraThinMaterial)
    }

    private func navLink(_ title: String, route: Route) -> some View {
        let active = isActive(route)
        // 设计语言：nav 不是填充紫胶囊，而是「青色文字 + 青色下划线」（对齐 .cy-nav__active）。
        return Button { store.navigate(to: route) } label: {
            Text(title)
                .font(.system(size: FontSize.sm, weight: .medium))
                .foregroundStyle(active ? Theme.signalPrimary : Theme.textSecondary)
                .shadow(color: active ? Theme.signalGlow : .clear, radius: active ? 8 : 0)
                .padding(.horizontal, Space.s2)
                .padding(.vertical, Space.s3)
                .overlay(alignment: .bottom) {
                    Capsule().fill(active ? Theme.signalPrimary : .clear)
                        .frame(height: 1.5).padding(.horizontal, Space.s2)
                }
        }
        .buttonStyle(.plain)
    }

    private func isActive(_ route: Route) -> Bool {
        switch (store.current, route) {
        case (.plaza, .plaza), (.open, .open), (.about, .about): return true
        default: return false
        }
    }

    @ViewBuilder
    private var accountControl: some View {
        if let user = store.currentUser {
            // 用 Button + popover 自绘下拉（不用 SwiftUI Menu —— 其自定义 label 会把头像
            // 当菜单图标放大渲染，吞掉 .frame/.clipShape）。对齐 React 的 cy-user-dropdown。
            Button { menuOpen.toggle() } label: {
                // 对齐 .cy-user-chip：昵称在左、头像在右、chevron 收尾；透明底 + 描边胶囊。
                HStack(spacing: Space.s2) {
                    Text(user.nickname).font(.system(size: FontSize.sm, weight: .medium)).foregroundStyle(Theme.textSecondary)
                    AvatarView(avatarId: user.avatarId, nickname: user.nickname, size: 24)
                    Image(systemName: "chevron.down").font(.system(size: 9)).foregroundStyle(Theme.textMuted)
                }
                .padding(.leading, Space.s3).padding(.trailing, Space.s2).padding(.vertical, 3)
                .overlay(Capsule().stroke(menuOpen ? Theme.signalPrimary : Theme.borderDefault, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .popover(isPresented: $menuOpen, arrowEdge: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    dropdownItem("我创建的", icon: "square.and.pencil") { store.navigate(to: .meCreated) }
                    dropdownItem("我收藏的", icon: "heart") { store.navigate(to: .meFavorites) }
                    dropdownItem("账号设置", icon: "gearshape") { store.navigate(to: .meProfile) }
                    Divider().padding(.vertical, Space.s1)
                    dropdownItem("登出", icon: "arrow.backward.square", danger: true) { Task { await store.logout() } }
                }
                .padding(Space.s2)
                .frame(width: 180)
            }
        } else {
            HStack(spacing: Space.s2) {
                Button("登录") { store.navigate(to: .login) }.buttonStyle(.ht(.ghost, .sm))
                Button("注册") { store.navigate(to: .register) }.buttonStyle(.ht(.primary, .sm))
            }
        }
    }

    private func dropdownItem(_ title: String, icon: String, danger: Bool = false, action: @escaping () -> Void) -> some View {
        Button { menuOpen = false; action() } label: {
            Label(title, systemImage: icon)
                .font(.system(size: FontSize.sm, weight: .medium))
                .foregroundStyle(danger ? Theme.dangerFg : Theme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, Space.s2).padding(.horizontal, Space.s3)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// 品牌图标：优先渲染 bundle 内 logo.svg（mac 14 原生认 SVG）；
/// 缺失时退化为三色渐变圆角块兜底（仍保品牌色，不至于空白）。
private struct LogoMark: View {
    var size: CGFloat = 32
    private static let image: NSImage? = {
        guard let url = Bundle.main.url(forResource: "logo", withExtension: "svg") else { return nil }
        return NSImage(contentsOf: url)
    }()
    var body: some View {
        if let img = Self.image {
            Image(nsImage: img).resizable().interpolation(.high)
                .frame(width: size, height: size)
        } else {
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Theme.brandGradient)
                .frame(width: size, height: size)
                .overlay(Image(systemName: "clock.fill").font(.system(size: size * 0.5)).foregroundStyle(.white))
        }
    }
}
