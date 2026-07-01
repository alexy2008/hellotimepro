// 8 位胶囊码输入：逐格键盘输入、自动前进、退格回退、整串粘贴。

import SwiftUI

struct CapsuleCodeInput: View {
    @Binding var code: String
    var onComplete: (String) -> Void

    @FocusState private var focus: Int?

    private func chars() -> [String] {
        var arr = Array(repeating: "", count: 8)
        for (i, c) in code.prefix(8).enumerated() { arr[i] = String(c) }
        return arr
    }

    var body: some View {
        HStack(spacing: Space.s2) {
            ForEach(0..<8, id: \.self) { i in
                box(i)
            }
        }
        .onAppear { focus = code.count < 8 ? code.count : 7 }
    }

    private func box(_ i: Int) -> some View {
        let arr = chars()
        return TextField("", text: Binding(
            get: { arr[i] },
            set: { handleInput(i, $0) }
        ))
        .textFieldStyle(.plain)
        .multilineTextAlignment(.center)
        .font(.system(size: FontSize.xl, weight: .semibold, design: .monospaced))
        .foregroundStyle(Theme.textPrimary)
        .frame(width: 46, height: 56)
        .background(Theme.surface3)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
            .stroke(focus == i ? Theme.borderFocus : Theme.borderDefault, lineWidth: focus == i ? 2 : 1))
        .focused($focus, equals: i)
        .onKeyPress(.delete) {
            if arr[i].isEmpty && i > 0 { focus = i - 1; return .handled }
            return .ignored
        }
    }

    private func handleInput(_ i: Int, _ raw: String) {
        let s = raw.uppercased().filter { $0.isLetter || $0.isNumber }
        var arr = chars()
        if s.count <= 1 {
            arr[i] = s
            code = String(arr.joined().prefix(8))
            if !s.isEmpty && i < 7 { focus = i + 1 }
        } else {
            // 整串粘贴：从当前格开始填充
            var idx = i
            for ch in s.prefix(8 - i) { arr[idx] = String(ch); idx += 1 }
            code = String(arr.joined().prefix(8))
            focus = min(idx, 7)
        }
        if code.count == 8 { onComplete(code) }
    }
}
