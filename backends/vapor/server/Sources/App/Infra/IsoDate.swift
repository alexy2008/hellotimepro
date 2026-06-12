import Foundation

/// 时间格式工具：解析/输出 ISO-8601，并保证 SQLite TEXT 落库格式与 seed 一致。
///
/// - **SQLite 落库**：`yyyy-MM-ddTHH:mm:ss.SSSSSS+00:00`（微秒 + 显式零偏移），
///   与 Python seed / 其它栈对齐；同一格式下字符串比较即时间比较，
///   `open_at <= :now`、`ORDER BY created_at` 直接用 TEXT 排序仍正确。
/// - **JSON 输出**：`yyyy-MM-ddTHH:mm:ss.SSSZ`（毫秒 + Z），即 ISO instant。
enum IsoDate {
    private static let parser: NSRegularExpression = {
        // 容忍：空格分隔、可变小数位（0-9 位）、Z / ±HH:MM / ±HHMM / 缺省偏移（按 UTC）
        let pattern = "^(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2}):(\\d{2})"
            + "(?:\\.(\\d{1,9}))?(Z|z|[+-]\\d{2}:?\\d{2})?$"
        return try! NSRegularExpression(pattern: pattern)
    }()

    private static let utcCalendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }()

    static func parse(_ raw: String) -> Date? {
        let s = raw.trimmingCharacters(in: .whitespaces)
        let range = NSRange(s.startIndex..., in: s)
        guard let m = parser.firstMatch(in: s, options: [], range: range) else { return nil }

        func group(_ i: Int) -> String? {
            let r = m.range(at: i)
            guard r.location != NSNotFound, let swiftRange = Range(r, in: s) else { return nil }
            return String(s[swiftRange])
        }

        var comps = DateComponents()
        comps.year = Int(group(1)!)
        comps.month = Int(group(2)!)
        comps.day = Int(group(3)!)
        comps.hour = Int(group(4)!)
        comps.minute = Int(group(5)!)
        comps.second = Int(group(6)!)
        guard let base = utcCalendar.date(from: comps) else { return nil }

        var interval = base.timeIntervalSince1970
        if let frac = group(7) {
            let padded = frac.padding(toLength: 9, withPad: "0", startingAt: 0)
            interval += Double(padded)! / 1_000_000_000
        }
        if let offset = group(8), offset != "Z", offset != "z" {
            let sign: Double = offset.hasPrefix("-") ? -1 : 1
            let digits = offset.dropFirst().replacingOccurrences(of: ":", with: "")
            guard digits.count == 4,
                  let hours = Double(digits.prefix(2)),
                  let minutes = Double(digits.suffix(2)) else { return nil }
            interval -= sign * (hours * 3600 + minutes * 60)
        }
        return Date(timeIntervalSince1970: interval)
    }

    static func sqliteString(_ date: Date) -> String {
        format(date, fractionDigits: 6) + "+00:00"
    }

    static func jsonString(_ date: Date) -> String {
        format(date, fractionDigits: 3) + "Z"
    }

    private static func format(_ date: Date, fractionDigits: Int) -> String {
        let totalMicros = Int64((date.timeIntervalSince1970 * 1_000_000).rounded())
        let seconds = Int64((Double(totalMicros) / 1_000_000.0).rounded(.down))
        let micros = Int(totalMicros - seconds * 1_000_000)
        let c = utcCalendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: Date(timeIntervalSince1970: TimeInterval(seconds))
        )
        let frac = fractionDigits == 6
            ? String(format: "%06d", micros)
            : String(format: "%03d", micros / 1000)
        return String(format: "%04d-%02d-%02dT%02d:%02d:%02d.", c.year!, c.month!, c.day!,
                      c.hour!, c.minute!, c.second!) + frac
    }
}
