// 日期解析与展示：对齐 React utils/format.ts。

import Foundation

struct Countdown {
    let expired: Bool
    let totalSeconds: Int
    let days: Int
    let hours: Int
    let minutes: Int
    let seconds: Int
}

enum DateUtil {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ s: String) -> Date? {
        withFraction.date(from: s) ?? plain.date(from: s)
    }

    /// 倒计时分解（对齐 countdownTo）。
    static func countdown(toISO iso: String, now: Date = Date()) -> Countdown {
        guard let target = parse(iso) else {
            return Countdown(expired: true, totalSeconds: 0, days: 0, hours: 0, minutes: 0, seconds: 0)
        }
        return countdown(toDate: target, now: now)
    }

    static func countdown(toDate target: Date, now: Date = Date()) -> Countdown {
        let diff = max(0, Int(target.timeIntervalSince(now)))
        return Countdown(
            expired: target <= now,
            totalSeconds: diff,
            days: diff / 86_400,
            hours: (diff % 86_400) / 3_600,
            minutes: (diff % 3_600) / 60,
            seconds: diff % 60
        )
    }

    /// `2026/06/21 14:30` 本地时间（对齐 fmtDateTime）。
    static func fmtDateTime(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "yyyy/MM/dd HH:mm"
        return f.string(from: d)
    }

    /// `2026/06/21` 本地日期（对齐 fmtDate）。
    static func fmtDate(_ iso: String) -> String {
        guard let d = parse(iso) else { return iso }
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "yyyy/MM/dd"
        return f.string(from: d)
    }

    /// Date → ISO 8601 UTC（提交用，对齐 localInputToIso）。
    static func iso(from date: Date) -> String {
        plain.string(from: date)
    }

    static func pad2(_ n: Int) -> String { String(format: "%02d", n) }
}
