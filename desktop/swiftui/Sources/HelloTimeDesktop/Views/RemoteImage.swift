// 远程 SVG 渲染：头像（/static/avatars）与技术栈图标（/static/icons）共用。
//
// 不自造图像 —— 与 Web 前端 <img src> 同一套后端资源。
// macOS 14 的 NSImage 可原生渲染 SVG；按 URL 做内存缓存。

import SwiftUI
import AppKit

actor SVGImageCache {
    static let shared = SVGImageCache()
    private var cache: [String: NSImage] = [:]

    func image(for url: URL) async -> NSImage? {
        let key = url.absoluteString
        if let hit = cache[key] { return hit }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let img = NSImage(data: data) else { return nil }
        cache[key] = img
        return img
    }
}

/// 加载并渲染远程 SVG；加载中显示 placeholder。
struct RemoteSVGImage<Placeholder: View>: View {
    let url: URL?
    @ViewBuilder var placeholder: () -> Placeholder
    @State private var image: NSImage?

    var body: some View {
        Group {
            if let image {
                Image(nsImage: image).resizable().interpolation(.high)
            } else {
                placeholder()
            }
        }
        .task(id: url) {
            guard let url else { return }
            image = await SVGImageCache.shared.image(for: url)
        }
    }
}

/// 圆形头像（真实头像 SVG）；加载前显示首字母占位圆。
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
