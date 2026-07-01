// 开启时间选择器：复刻 React components/DateTimePicker.tsx 的重构版。
//
// 触发按钮（⏱ 显示值 + 距开启）→ 弹层：
//   顶栏：摘要 + 可键盘输入的 年/月/日/时/分（↑↓ 增减）+ 取消/确认
//   面板：日历（周一起）+ 时间（小时/分钟下拉 + 模拟时钟表盘）
//   底部：快捷预设
// draft 模式：弹层内编辑 draft，点「确认」才提交给绑定值。

import SwiftUI

struct DateTimePicker: View {
    @Binding var date: Date

    @State private var open = false
    @State private var draft = Date()
    @State private var viewMonth = Date()
    @State private var py = ""
    @State private var pmo = ""
    @State private var pd = ""
    @State private var ph = ""
    @State private var pmin = ""

    private let cal = Calendar(identifier: .gregorian)
    private let weekdays = ["一", "二", "三", "四", "五", "六", "日"]

    var body: some View {
        Button { beginEdit() } label: { triggerLabel }
            .buttonStyle(.plain)
            .popover(isPresented: $open, arrowEdge: .bottom) { popover }
    }

    // MARK: - 触发按钮

    private var triggerLabel: some View {
        HStack(spacing: Space.s3) {
            Image(systemName: "clock").foregroundStyle(Theme.signalPrimary)
            HStack(spacing: Space.s2) {
                Text(formatDisplay(date)).font(.system(size: FontSize.base, weight: .medium)).foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Text(formatDistance(date)).font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted)
                    .lineLimit(1)
            }
            .lineLimit(1)
            Spacer()
            Image(systemName: "chevron.down").font(.system(size: 11)).foregroundStyle(Theme.textMuted)
        }
        .padding(.vertical, Space.s3).padding(.horizontal, Space.s4)
        .background(Theme.surface3)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
            .stroke(open ? Theme.signalPrimary : Theme.borderDefault, lineWidth: 1))
    }

    // MARK: - 弹层

    private var popover: some View {
        VStack(alignment: .leading, spacing: Space.s4) {
            topbar
            Divider().overlay(Theme.borderSubtle)
            HStack(alignment: .top, spacing: Space.s6) {
                calendar
                timePane
            }
            Divider().overlay(Theme.borderSubtle)
            presets
        }
        .padding(Space.s5)
        .frame(width: 460)
        .background(Theme.surface1)
    }

    private var topbar: some View {
        VStack(alignment: .leading, spacing: Space.s3) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("选择开启时刻").font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted)
                    Text(formatDistance(draft)).font(.system(size: FontSize.base, weight: .semibold)).foregroundStyle(Theme.signalPrimary)
                }
                Spacer()
                Button("取消") { open = false }.buttonStyle(.ht(.ghost, .sm))
                Button("确认") { date = draft; open = false }.buttonStyle(.ht(.primary, .sm))
            }
            manualRow
        }
    }

    // MARK: - 手动输入行（可键盘直接打字 + ↑↓ 调整）

    private var manualRow: some View {
        HStack(spacing: Space.s1) {
            manualField($py, field: .year, width: 56)
            Text("年").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
            manualField($pmo, field: .month, width: 38)
            Text("月").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
            manualField($pd, field: .day, width: 38)
            Text("日").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
            manualField($ph, field: .hour, width: 38)
            Text(":").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
            manualField($pmin, field: .minute, width: 38)
        }
        .padding(.vertical, Space.s2).padding(.horizontal, Space.s3)
        .background(Theme.surface3)
        .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
    }

    private func manualField(_ text: Binding<String>, field: ManualField, width: CGFloat) -> some View {
        TextField("", text: text)
            .textFieldStyle(.plain)
            .multilineTextAlignment(.center)
            .font(.system(size: FontSize.base, design: .monospaced))
            .foregroundStyle(Theme.textPrimary)
            .frame(width: width)
            .padding(.vertical, 4)
            .background(Theme.surface2)
            .clipShape(RoundedRectangle(cornerRadius: Radius.xs, style: .continuous))
            .onChange(of: text.wrappedValue) { setManualPart(field, text.wrappedValue, binding: text) }
            .onKeyPress(.upArrow) { adjust(field, 1); return .handled }
            .onKeyPress(.downArrow) { adjust(field, -1); return .handled }
            .onSubmit { normalizeManual() }
    }

    // MARK: - 日历

    private var calendar: some View {
        VStack(spacing: Space.s2) {
            HStack {
                Button { viewMonth = addMonths(viewMonth, -1) } label: { Image(systemName: "chevron.left") }
                    .buttonStyle(.plain).foregroundStyle(Theme.textSecondary)
                Spacer()
                Text("\(comp(viewMonth).year!)年\(comp(viewMonth).month!)月")
                    .font(.system(size: FontSize.sm, weight: .semibold)).foregroundStyle(Theme.textPrimary)
                Spacer()
                Button { viewMonth = addMonths(viewMonth, 1) } label: { Image(systemName: "chevron.right") }
                    .buttonStyle(.plain).foregroundStyle(Theme.textSecondary)
            }
            let cols = Array(repeating: GridItem(.fixed(30), spacing: 2), count: 7)
            LazyVGrid(columns: cols, spacing: 2) {
                ForEach(weekdays, id: \.self) { w in
                    Text(w).font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted).frame(width: 30, height: 22)
                }
                ForEach(0..<leadingBlanks, id: \.self) { _ in Color.clear.frame(width: 30, height: 30) }
                ForEach(1...daysInMonth, id: \.self) { day in dayCell(day) }
            }
        }
        .frame(width: 226)
    }

    private func dayCell(_ day: Int) -> some View {
        let selected = isSameDay(draft, viewMonth, day)
        let today = isSameDay(Date(), viewMonth, day)
        return Button { pickDay(day) } label: {
            Text("\(day)")
                .font(.system(size: FontSize.sm, weight: selected ? .bold : .regular))
                .foregroundStyle(selected ? Theme.signalOn : Theme.textSecondary)
                .frame(width: 30, height: 30)
                .background(selected ? Theme.signalPrimary : Color.clear)
                .clipShape(Circle())
                .overlay(Circle().stroke(today && !selected ? Theme.signalPrimary : .clear, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - 时间面板（下拉 + 模拟时钟）

    private var timePane: some View {
        VStack(spacing: Space.s4) {
            HStack(spacing: Space.s3) {
                VStack(spacing: Space.s1) {
                    Text("小时").font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted)
                    Picker("", selection: Binding(get: { comp(draft).hour ?? 0 }, set: { setHour($0) })) {
                        ForEach(0..<24, id: \.self) { Text(DateUtil.pad2($0)).tag($0) }
                    }.labelsHidden().frame(width: 70)
                }
                VStack(spacing: Space.s1) {
                    Text("分钟").font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted)
                    Picker("", selection: Binding(get: { comp(draft).minute ?? 0 }, set: { setMinute($0) })) {
                        ForEach(minuteOptions, id: \.self) { Text(DateUtil.pad2($0)).tag($0) }
                    }.labelsHidden().frame(width: 70)
                }
            }
            ClockFace(hour: comp(draft).hour ?? 0, minute: comp(draft).minute ?? 0)
        }
    }

    // MARK: - 预设

    private var presets: some View {
        HStack(spacing: Space.s2) {
            preset("1分钟后") { withPreset(seconds: 120) }
            preset("1小时后") { withPreset(seconds: 3600) }
            preset("明天9:00") { tomorrow9() }
            preset("1年后") { addYears(1) }
            preset("2030.01.01") { y2030() }
        }
    }

    private func preset(_ label: String, _ make: @escaping () -> Date) -> some View {
        Button(label) { let d = make(); draft = d; viewMonth = startOfMonth(d) }
            .buttonStyle(.ht(.ghost, .sm))
    }

    // MARK: - draft 编辑逻辑

    private func beginEdit() {
        draft = date
        viewMonth = startOfMonth(date)
        syncParts(from: date)
        open = true
    }

    private func syncParts(from d: Date) {
        let c = comp(d)
        py = String(c.year!); pmo = DateUtil.pad2(c.month!); pd = DateUtil.pad2(c.day!)
        ph = DateUtil.pad2(c.hour!); pmin = DateUtil.pad2(c.minute!)
    }

    private func pickDay(_ day: Int) {
        let t = comp(draft)
        draft = cal.date(from: DateComponents(year: comp(viewMonth).year, month: comp(viewMonth).month,
                                              day: day, hour: t.hour, minute: t.minute)) ?? draft
        syncParts(from: draft)
    }
    private func setHour(_ h: Int) { draft = cal.date(bySettingHour: h, minute: comp(draft).minute ?? 0, second: 0, of: draft) ?? draft; syncParts(from: draft) }
    private func setMinute(_ m: Int) { draft = cal.date(bySettingHour: comp(draft).hour ?? 0, minute: m, second: 0, of: draft) ?? draft; syncParts(from: draft) }

    private func setManualPart(_ field: ManualField, _ raw: String, binding: Binding<String>) {
        let maxLen = field == .year ? 4 : 2
        let digits = String(raw.filter(\.isNumber).prefix(maxLen))
        if digits != raw { binding.wrappedValue = digits }
        tryCommitManual()
    }

    private func tryCommitManual() {
        guard py.count == 4, !pmo.isEmpty, !pd.isEmpty, !ph.isEmpty, !pmin.isEmpty,
              let y = Int(py), let mo = Int(pmo), let d = Int(pd), let h = Int(ph), let mi = Int(pmin),
              y >= 1, (1...12).contains(mo), (0...23).contains(h), (0...59).contains(mi) else { return }
        let maxDay = daysIn(year: y, month: mo)
        guard (1...maxDay).contains(d) else { return }
        if let nd = cal.date(from: DateComponents(year: y, month: mo, day: d, hour: h, minute: mi)) {
            draft = nd; viewMonth = startOfMonth(nd)
        }
    }

    private func normalizeManual() {
        let c = comp(draft)
        let y = min(9999, max(1, Int(py) ?? c.year!))
        let mo = min(12, max(1, Int(pmo) ?? c.month!))
        let d = min(daysIn(year: y, month: mo), max(1, Int(pd) ?? c.day!))
        let h = min(23, max(0, Int(ph) ?? c.hour!))
        let mi = min(59, max(0, Int(pmin) ?? c.minute!))
        if let nd = cal.date(from: DateComponents(year: y, month: mo, day: d, hour: h, minute: mi)) {
            draft = nd; viewMonth = startOfMonth(nd); syncParts(from: nd)
        }
    }

    private func adjust(_ field: ManualField, _ delta: Int) {
        var nd = draft
        switch field {
        case .year: nd = cal.date(byAdding: .year, value: delta, to: draft) ?? draft
        case .month: nd = cal.date(byAdding: .month, value: delta, to: draft) ?? draft
        case .day: nd = cal.date(byAdding: .day, value: delta, to: draft) ?? draft
        case .hour: nd = cal.date(byAdding: .hour, value: delta, to: draft) ?? draft
        case .minute: nd = cal.date(byAdding: .minute, value: delta, to: draft) ?? draft
        }
        draft = nd; viewMonth = startOfMonth(nd); syncParts(from: nd)
    }

    // 预设
    private func withPreset(seconds: TimeInterval) -> Date {
        cal.date(bySetting: .second, value: 0, of: Date().addingTimeInterval(seconds)) ?? Date().addingTimeInterval(seconds)
    }
    private func tomorrow9() -> Date {
        let t = cal.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return cal.date(bySettingHour: 9, minute: 0, second: 0, of: t) ?? t
    }
    private func addYears(_ n: Int) -> Date { cal.date(byAdding: .year, value: n, to: Date()) ?? Date() }
    private func y2030() -> Date { cal.date(from: DateComponents(year: 2030, month: 1, day: 1, hour: 0, minute: 0)) ?? Date() }

    // MARK: - 计算属性 / 工具

    private var leadingBlanks: Int { (cal.component(.weekday, from: startOfMonth(viewMonth)) - 1 + 6) % 7 }
    private var daysInMonth: Int { cal.range(of: .day, in: .month, for: viewMonth)?.count ?? 30 }
    private var minuteOptions: [Int] {
        var s = Array(stride(from: 0, to: 60, by: 5))
        let m = comp(draft).minute ?? 0
        if !s.contains(m) { s.append(m); s.sort() }
        return s
    }

    private func comp(_ d: Date) -> DateComponents { cal.dateComponents([.year, .month, .day, .hour, .minute], from: d) }
    private func startOfMonth(_ d: Date) -> Date { cal.date(from: cal.dateComponents([.year, .month], from: d)) ?? d }
    private func addMonths(_ d: Date, _ n: Int) -> Date { cal.date(byAdding: .month, value: n, to: startOfMonth(d)) ?? d }
    private func daysIn(year: Int, month: Int) -> Int {
        let d = cal.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()
        return cal.range(of: .day, in: .month, for: d)?.count ?? 30
    }
    private func isSameDay(_ d: Date, _ monthRef: Date, _ day: Int) -> Bool {
        let c = comp(d); let mc = comp(monthRef)
        return c.year == mc.year && c.month == mc.month && c.day == day
    }

    private func formatDisplay(_ d: Date) -> String {
        let c = comp(d)
        return "\(c.year!)年\(c.month!)月\(c.day!)日 \(DateUtil.pad2(c.hour!)):\(DateUtil.pad2(c.minute!))"
    }
    private func formatDistance(_ d: Date) -> String {
        let diffMin = Int(ceil(d.timeIntervalSinceNow / 60))
        if diffMin <= 0 { return "已到开启时刻" }
        if diffMin < 60 { return "距开启 \(diffMin) 分钟" }
        let h = diffMin / 60, m = diffMin % 60
        if h < 24 { return "距开启 \(h) 小时" + (m > 0 ? " \(m) 分钟" : "") }
        let days = h / 24, rh = h % 24
        if days < 365 { return "距开启 \(days) 天" + (rh > 0 ? " \(rh) 小时" : "") }
        let years = days / 365, rd = days % 365
        return "距开启 \(years) 年" + (rd > 0 ? " \(rd) 天" : "")
    }

    private enum ManualField { case year, month, day, hour, minute }
}

// MARK: - 模拟时钟表盘

private struct ClockFace: View {
    let hour: Int
    let minute: Int

    var body: some View {
        ZStack {
            Circle().fill(Theme.surface2).overlay(Circle().stroke(Theme.borderSubtle, lineWidth: 1))
            // 12 个小时刻度数字（三角定位，保持正向）
            ForEach(0..<12, id: \.self) { i in
                let display = i == 0 ? 12 : i
                let angle = Double(i) * 30 * .pi / 180
                Text("\(display)")
                    .font(.system(size: 9, weight: hour % 12 == i % 12 ? .bold : .regular))
                    .foregroundStyle(hour % 12 == i % 12 ? Theme.signalPrimary : Theme.textMuted)
                    .offset(x: 38 * sin(angle), y: -38 * cos(angle))
            }
            // 时针
            Capsule().fill(Theme.textPrimary).frame(width: 3, height: 26)
                .offset(y: -13)
                .rotationEffect(.degrees(Double(hour % 12) * 30 + Double(minute) * 0.5))
            // 分针
            Capsule().fill(Theme.signalPrimary).frame(width: 2, height: 34)
                .offset(y: -17)
                .rotationEffect(.degrees(Double(minute) * 6))
            Circle().fill(Theme.signalPrimary).frame(width: 6, height: 6)
        }
        .frame(width: 96, height: 96)
    }
}
