// 收藏按钮：匿名→引导登录；登录→乐观切换。sm（卡片）/ md（详情）两档。

import SwiftUI

struct FavoriteButton: View {
    @Environment(AppStore.self) private var store
    let id: String
    var favoritedByMe: Bool
    var favoriteCount: Int
    var size: BtnSize = .sm
    var onChange: ((Bool, Int) -> Void)? = nil

    @State private var active: Bool
    @State private var count: Int
    @State private var busy = false

    init(id: String, favoritedByMe: Bool, favoriteCount: Int, size: BtnSize = .sm, onChange: ((Bool, Int) -> Void)? = nil) {
        self.id = id; self.favoritedByMe = favoritedByMe; self.favoriteCount = favoriteCount
        self.size = size; self.onChange = onChange
        _active = State(initialValue: favoritedByMe)
        _count = State(initialValue: favoriteCount)
    }

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: Space.s1) {
                Image(systemName: active ? "heart.fill" : "heart")
                    .foregroundStyle(active ? Theme.favoriteActive : Theme.favoriteInactive)
                if size == .md {
                    Text("收藏 · \(count)").foregroundStyle(Theme.textSecondary)
                } else {
                    Text("\(count)").font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted)
                }
            }
            .font(.system(size: size == .md ? FontSize.base : FontSize.sm))
            .modifier(MdChrome(enabled: size == .md))
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .onChange(of: favoritedByMe) { active = favoritedByMe }
        .onChange(of: favoriteCount) { count = favoriteCount }
    }

    private func toggle() {
        guard store.isAuthenticated else { store.requireLogin(); return }
        busy = true
        Task {
            defer { busy = false }
            do {
                let token = try store.requireToken(); _ = token
                if active {
                    try await store.api.unfavorite(capsuleId: id)
                    active = false; count = max(0, count - 1)
                } else {
                    let r = try await store.api.favorite(capsuleId: id)
                    active = true; count = r.favoriteCount
                }
                onChange?(active, count)
            } catch { store.report(error) }
        }
    }
}

private struct MdChrome: ViewModifier {
    let enabled: Bool
    func body(content: Content) -> some View {
        if enabled {
            content.padding(.vertical, Space.s2).padding(.horizontal, Space.s4)
                .background(Theme.surface2).clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Theme.borderDefault, lineWidth: 1))
        } else { content }
    }
}
