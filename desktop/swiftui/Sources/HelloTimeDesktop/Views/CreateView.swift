// 创建胶囊：标题(+AI生成) · AI 推荐灵感 · 正文(计数) · 开启时间(日历/键盘) · 预设 · 可见性。
// 对齐 React CreatePage。

import SwiftUI

struct CreateView: View {
    @Environment(AppStore.self) private var store

    @State private var title = ""
    @State private var content = ""
    @State private var openAt = Date().addingTimeInterval(3600)
    @State private var inPlaza = true
    @State private var busy = false
    @State private var err: String?

    @State private var aiBusy = false
    @State private var aiInfo: String?
    @State private var aiGenerated = false

    @State private var recos: [CapsuleRecommendation] = []
    @State private var recoBusy = false
    @State private var recoLoaded = false

    private var minDate: Date { Date().addingTimeInterval(120) }
    private var maxDate: Date { Date().addingTimeInterval(10 * 365 * 86_400) }
    private var canSubmit: Bool { !title.trimmed.isEmpty && title.count <= 60 && !content.isEmpty && content.count <= 5000 }

    var body: some View {
        Container(maxWidth: Layout.containerNarrow) {
            VStack(alignment: .leading, spacing: Space.s6) {
                VStack(alignment: .leading, spacing: Space.s2) {
                    Text("写给未来的信").font(.display(FontSize.xxxxl)).foregroundStyle(Theme.textPrimary)
                    Text("这段文字会被上锁，直到你设定的时刻才能由任何人（包括你自己）开启。")
                        .font(.system(size: FontSize.base)).foregroundStyle(Theme.textSecondary)
                }

                titleField
                if title.trimmed.isEmpty && !recos.isEmpty {
                    RecommendationStrip(recos: recos, busy: recoBusy, disabled: aiBusy, onPick: pickReco, onRefresh: { Task { await loadRecos() } })
                }
                contentField
                dateField

                HTAlert(variant: .info, text: "上锁后不可编辑、不可提前开启；可以在「我创建的」列表里随时撤回（删除）。")
                if let err { HTAlert(variant: .danger, text: err) }

                // 底部操作栏：可见性开关（左）+ 取消/封存（右），对齐 cy-create-actions
                HStack(spacing: Space.s4) {
                    Toggle(isOn: $inPlaza) {
                        Text("发布到胶囊广场").font(.system(size: FontSize.base)).foregroundStyle(Theme.textSecondary)
                    }
                    .toggleStyle(.switch).tint(Theme.signalPrimary).fixedSize()
                    Spacer()
                    Button("取消") { store.navigate(to: .plaza) }.buttonStyle(.ht(.ghost, .md))
                    Button { submit() } label: {
                        HStack { if busy { ProgressView().controlSize(.small) }; Text(busy ? "封存中…" : "🔒 上锁封存") }
                    }
                    .buttonStyle(.ht(.primary, .lg)).disabled(busy || !canSubmit)
                }
            }
            .padding(.vertical, Space.s8)
        }
        .task { if !recoLoaded { recoLoaded = true; await loadRecos() } }
    }

    // MARK: - 字段

    private var titleField: some View {
        VStack(alignment: .leading, spacing: Space.s2) {
            FieldLabel(text: "标题", hint: "· 最多 60 字")
            HStack(spacing: Space.s2) {
                TextField("", text: $title, prompt: Text("给这枚胶囊起个名字").foregroundColor(Theme.textDisabled))
                    .fieldStyle()
                    .onChange(of: title) { if title.count > 60 { title = String(title.prefix(60)) } }
                Button { aiGenerate() } label: {
                    HStack { if aiBusy { ProgressView().controlSize(.small) }; Text(aiBusy ? "生成中…" : aiGenerated ? "✨ 重新生成" : "✨ AI 生成") }
                }
                .buttonStyle(.ht(.ghost, .md)).disabled(aiBusy)
                .help("让 AI 生成胶囊正文与建议开启时间；标题留空时会顺便起个标题")
            }
            if let aiInfo { Text(aiInfo).font(.system(size: FontSize.sm)).foregroundStyle(Theme.textSecondary) }
        }
    }

    private var contentField: some View {
        VStack(alignment: .leading, spacing: Space.s2) {
            FieldLabel(text: "内容", hint: "· 最多 5000 字")
            TextEditor(text: $content)
                .font(.system(size: FontSize.base)).foregroundStyle(Theme.textPrimary)
                .scrollContentBackground(.hidden).frame(minHeight: 200)
                .padding(Space.s3).background(Theme.surface3)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Theme.borderDefault, lineWidth: 1))
                .onChange(of: content) { if content.count > 5000 { content = String(content.prefix(5000)) } }
            Text("\(content.count) / 5000").font(.system(size: FontSize.xs)).foregroundStyle(Theme.textDisabled)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    private var dateField: some View {
        VStack(alignment: .leading, spacing: Space.s3) {
            HStack(spacing: Space.s3) {
                FieldLabel(text: "开启时间", hint: "· 最早 60 秒后")
                DateTimePicker(date: $openAt)
            }
            // 快速预设（紧贴选择器下方，对齐 cy-create-presets）
            HStack(spacing: Space.s2) {
                Text("快速预设").font(.system(size: FontSize.sm, weight: .medium)).foregroundStyle(Theme.textMuted)
                preset("1 分钟后（测试）") { Date().addingTimeInterval(130) }
                preset("1 小时后") { Date().addingTimeInterval(3600) }
                preset("明天 9:00") { tomorrowAt9() }
                preset("1 年后") { Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date() }
                preset("2030.01.01") { Calendar.current.date(from: DateComponents(year: 2030, month: 1, day: 1, hour: 0, minute: 0)) ?? Date() }
            }
        }
    }

    private func preset(_ label: String, _ make: @escaping () -> Date) -> some View {
        Button(label) { openAt = make() }.buttonStyle(.ht(.ghost, .sm))
    }

    private func tomorrowAt9() -> Date {
        let cal = Calendar.current
        let t = cal.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return cal.date(bySettingHour: 9, minute: 0, second: 0, of: t) ?? t
    }

    // MARK: - AI

    private func aiGenerate() { runAi(rawTitle: title) }
    private func pickReco(_ r: CapsuleRecommendation) { title = r.title; content = ""; aiGenerated = false; runAi(rawTitle: r.title) }

    private func runAi(rawTitle: String) {
        let t = rawTitle.trimmed
        let autoTitle = t.isEmpty
        aiBusy = true; err = nil; aiInfo = nil
        Task {
            defer { aiBusy = false }
            do {
                let s = try await store.api.suggestCapsule(title: t.isEmpty ? nil : t)
                content = s.content
                if let d = DateUtil.parse(s.openAt) { openAt = min(max(d, minDate), maxDate) }
                aiGenerated = true
                if let aiTitle = s.title, autoTitle, title.trimmed.isEmpty { title = aiTitle }
                let source = s.generatedBy == "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy
                let note = (s.title != nil && autoTitle) ? "标题与正文均由 AI 生成" : "已为你生成正文"
                aiInfo = "\(note)，建议 \(s.openInDays) 天后开启 · 来源：\(source)"
            } catch { err = (error as? LocalizedError)?.errorDescription ?? "AI 生成失败，请稍后重试" }
        }
    }

    private func loadRecos() async {
        recoBusy = true
        defer { recoBusy = false }
        do {
            let list = try await store.api.capsuleRecommendations(count: 4)
            if !list.items.isEmpty { recos = list.items }
        } catch { /* 锦上添花，失败静默 */ }
    }

    // MARK: - 提交

    private func submit() {
        busy = true; err = nil
        Task {
            defer { busy = false }
            do {
                // 不预检 token：createCapsule(auth) 会在 access 缺失时自动 refresh + 重放，
                // 预检会在会话恢复但 access 尚未刷新的窗口里误报未登录。
                let created = try await store.api.createCapsule(
                    CreateCapsuleRequest(title: title.trimmed, content: content, openAt: DateUtil.iso(from: openAt), inPlaza: inPlaza))
                store.push(.capsule(created.code))
            } catch { err = (error as? LocalizedError)?.errorDescription ?? "创建失败" }
        }
    }
}

extension String { var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) } }
