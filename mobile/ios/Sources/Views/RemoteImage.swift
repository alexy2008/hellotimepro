// 远程 SVG 渲染：头像（/static/avatars）与技术栈图标（/static/icons）共用。
// iOS 的 UIImage 不认 SVG，用 SVGView（exyte）渲染；按 URL 做内存数据缓存。
// = desktop/swiftui RemoteImage.swift（那边用 NSImage）。

import SwiftUI
import SVGView

actor SVGDataCache {
    static let shared = SVGDataCache()
    private var cache: [String: Data] = [:]

    func data(for url: URL) async -> Data? {
        let key = url.absoluteString
        if let hit = cache[key] { return hit }
        guard let (data, _) = try? await URLSession.shared.data(from: url) else { return nil }
        cache[key] = data
        return data
    }
}

/// 加载并渲染远程 SVG；加载中显示 placeholder。
struct RemoteSVGImage<Placeholder: View>: View {
    let url: URL?
    @ViewBuilder var placeholder: () -> Placeholder
    @State private var data: Data?

    var body: some View {
        Group {
            if let data {
                SVGView(data: data)
            } else {
                placeholder()
            }
        }
        .task(id: url) {
            guard let url else { return }
            data = await SVGDataCache.shared.data(for: url)
        }
    }
}

/// 圆形头像（真实头像 SVG）；加载前/失败显示首字母占位圆。
struct AvatarView: View {
    @Environment(AppStore.self) private var store
    let avatarId: String
    var nickname: String = ""
    var size: CGFloat = 36

    var body: some View {
        RemoteSVGImage(url: store.api.avatarURL(id: avatarId)) {
            AvatarBadge(nickname: nickname.isEmpty ? avatarId : nickname, size: size)
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}
