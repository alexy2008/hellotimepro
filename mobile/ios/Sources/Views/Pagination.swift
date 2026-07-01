// 通用分页器：上一页 / 第 X / Y 页 · 共 N 条 / 下一页（对齐 React Pagination）。

import SwiftUI

struct PaginationBar: View {
    let page: Int
    let totalPages: Int
    var total: Int? = nil
    let onChange: (Int) -> Void

    var body: some View {
        if totalPages > 1 {
            HStack(spacing: Space.s4) {
                Button("上一页") { onChange(page - 1) }.buttonStyle(.ht(.ghost, .sm)).disabled(page <= 1)
                Text("第 \(page) / \(totalPages) 页" + (total.map { " · 共 \($0) 条" } ?? ""))
                    .font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
                Button("下一页") { onChange(page + 1) }.buttonStyle(.ht(.ghost, .sm)).disabled(page >= totalPages)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Space.s8)
        }
    }
}
