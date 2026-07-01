// 注册页：邮箱 + 昵称 + 密码 + 头像选择（对齐 React RegisterPage）。

import SwiftUI

struct RegisterView: View {
    @Environment(AppStore.self) private var store
    @State private var email = ""
    @State private var nickname = ""
    @State private var password = ""
    @State private var avatarId: String?
    @State private var avatars: [Avatar] = []
    @State private var busy = false
    @State private var err: String?

    private var canSubmit: Bool {
        !email.isEmpty && nickname.count >= 2 && password.count >= 8 && avatarId != nil
    }

    var body: some View {
        Container(maxWidth: 560) {
            VStack(spacing: Space.s5) {
                VStack(alignment: .leading, spacing: Space.s5) {
                    VStack(alignment: .leading, spacing: Space.s2) {
                        Text("注册新身份").font(.display(FontSize.xxxl)).foregroundStyle(Theme.textPrimary)
                        Text("选一个赛博头像、写一封最早 60 秒后才能打开的信。").font(.system(size: FontSize.base)).foregroundStyle(Theme.textSecondary)
                    }
                    field("邮箱", text: $email, prompt: "you@example.com")
                    field("昵称", text: $nickname, prompt: "2–20 个字符")
                    secure("密码", text: $password, prompt: "至少 8 位，含字母和数字")
                    VStack(alignment: .leading, spacing: Space.s2) {
                        FieldLabel(text: "选择头像（必选）")
                        AvatarPicker(avatars: avatars, selected: $avatarId)
                        Text("10 个内置头像，不支持上传自定义头像。").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
                    }
                    Button { submit() } label: {
                        HStack { if busy { ProgressView().controlSize(.small) }; Text(busy ? "提交中…" : "创建账号并进入创建胶囊") }
                    }
                    .buttonStyle(.ht(.primary, .lg, fullWidth: true)).disabled(busy || !canSubmit)
                    HStack(spacing: Space.s1) {
                        Text("已有账号？").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
                        Button("去登录") { store.navigate(to: .login) }.buttonStyle(.plain)
                            .font(.system(size: FontSize.sm)).foregroundStyle(Theme.textLink)
                    }
                    .frame(maxWidth: .infinity)
                }
                .cardStyle(padding: Space.s8)
                if let err { HTAlert(variant: .danger, text: err) }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Space.s12)
        }
        .task { await loadAvatars() }
    }

    private func field(_ l: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: Space.s2) {
            FieldLabel(text: l)
            TextField("", text: text, prompt: Text(prompt).foregroundColor(Theme.textDisabled)).fieldStyle()
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
        catch { err = "拉取头像列表失败，请检查后端是否已启动" }
    }

    private func submit() {
        guard let avatarId else { return }
        busy = true; err = nil
        Task {
            defer { busy = false }
            do { try await store.register(email: email.trimmed, password: password, nickname: nickname.trimmed, avatarId: avatarId) }
            catch { err = (error as? LocalizedError)?.errorDescription ?? "注册失败" }
        }
    }
}
