// 登录 / 注册 sheet（二合一，分段切换）。登录/注册成功后 store.apply 置 showAuthSheet=false → sheet 自动关闭。
// = desktop/swiftui LoginView + RegisterView 合并为移动 sheet。
import SwiftUI

struct AuthSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private enum Mode: String, CaseIterable { case login = "登录", register = "注册" }
    @State private var mode: Mode = .login

    // 共用
    @State private var email = ""
    @State private var password = ""
    // 注册
    @State private var nickname = ""
    @State private var avatarId: String?
    @State private var avatars: [Avatar] = []

    @State private var busy = false
    @State private var err: String?

    private var loginOK: Bool { !email.isEmpty && !password.isEmpty }
    private var registerOK: Bool { !email.isEmpty && nickname.trimmed.count >= 2 && password.count >= 8 && avatarId != nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.s5) {
                    Picker("", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    Text(mode == .login ? "你留给未来的信，还在等你开启。" : "选一个赛博头像、写一封最早 60 秒后才能打开的信。")
                        .font(.system(size: FontSize.sm)).foregroundStyle(Theme.textSecondary)

                    field("邮箱", text: $email, prompt: "you@example.com")
                    if mode == .register { field("昵称", text: $nickname, prompt: "2–20 个字符") }
                    secure("密码", text: $password, prompt: "至少 8 位，含字母和数字")

                    if mode == .register {
                        VStack(alignment: .leading, spacing: Space.s2) {
                            FieldLabel(text: "选择头像（必选）")
                            AvatarPicker(avatars: avatars, selected: $avatarId)
                            Text("10 个内置头像，不支持上传自定义头像。").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
                        }
                    }

                    if let err { HTAlert(variant: .danger, text: err) }

                    Button { submit() } label: {
                        HStack { if busy { ProgressView().controlSize(.small) }
                            Text(busy ? "提交中…" : (mode == .login ? "登录" : "创建账号")) }
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.ht(.primary, .lg, fullWidth: true))
                    .disabled(busy || (mode == .login ? !loginOK : !registerOK))
                }
                .padding(Space.s5)
            }
            .background(Theme.surface0)
            .navigationTitle(mode == .login ? "欢迎回来" : "注册新身份")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
            .task { await loadAvatars() }
        }
    }

    private func field(_ l: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: Space.s2) {
            FieldLabel(text: l)
            TextField("", text: text, prompt: Text(prompt).foregroundColor(Theme.textDisabled))
                .fieldStyle().textInputAutocapitalization(.never).autocorrectionDisabled()
        }
    }
    private func secure(_ l: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: Space.s2) {
            FieldLabel(text: l)
            SecureField("", text: text, prompt: Text(prompt).foregroundColor(Theme.textDisabled)).fieldStyle()
        }
    }

    private func loadAvatars() async {
        guard avatars.isEmpty else { return }
        do { avatars = try await store.api.avatars(); if avatarId == nil { avatarId = avatars.first?.id } }
        catch { /* 注册时再提示 */ }
    }

    private func submit() {
        busy = true; err = nil
        Task {
            defer { busy = false }
            do {
                if mode == .login {
                    try await store.login(email: email.trimmed, password: password)
                } else {
                    guard let avatarId else { err = "请选择一个头像"; return }
                    try await store.register(email: email.trimmed, password: password, nickname: nickname.trimmed, avatarId: avatarId)
                }
                // 成功：store.apply 已置 showAuthSheet=false，sheet 自动关闭
            } catch { err = (error as? LocalizedError)?.errorDescription ?? "操作失败" }
        }
    }
}
