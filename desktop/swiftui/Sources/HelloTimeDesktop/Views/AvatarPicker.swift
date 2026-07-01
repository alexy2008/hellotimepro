// 头像选择：真实头像 SVG 网格，单选高亮（对齐 React AvatarPicker）。

import SwiftUI

struct AvatarPicker: View {
    let avatars: [Avatar]
    @Binding var selected: String?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: Space.s3), count: 5)

    var body: some View {
        LazyVGrid(columns: columns, spacing: Space.s3) {
            ForEach(avatars) { a in
                Button { selected = a.id } label: {
                    AvatarView(avatarId: a.id, nickname: a.name, size: 48)
                        .overlay(Circle().stroke(Theme.brandPrimary, lineWidth: selected == a.id ? 3 : 0))
                        .padding(2)
                }
                .buttonStyle(.plain)
                .help(a.name)
            }
        }
    }
}
