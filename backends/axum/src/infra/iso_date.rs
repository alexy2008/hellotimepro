use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use regex::Regex;
use std::sync::OnceLock;

/// 时间格式工具：解析/输出 ISO-8601，并保证 SQLite TEXT 落库格式与 seed 一致。
///
/// - **SQLite 落库**：`yyyy-MM-ddTHH:mm:ss.SSSSSS+00:00`（微秒 + 显式零偏移），
///   与 Python seed / 其它栈对齐；同一格式下字符串比较即时间比较，
///   `open_at <= :now`、`ORDER BY created_at` 直接用 TEXT 排序仍正确。
/// - **JSON 输出**：`yyyy-MM-ddTHH:mm:ss.SSSZ`（毫秒 + Z），即 ISO instant。

fn parser() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        // 容忍：空格分隔、可变小数位（0-9 位）、Z / ±HH:MM / ±HHMM / 缺省偏移（按 UTC）
        Regex::new(
            r"^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|z|[+-]\d{2}:?\d{2})?$",
        )
        .unwrap()
    })
}

pub fn parse(raw: &str) -> Option<DateTime<Utc>> {
    let s = raw.trim();
    let m = parser().captures(s)?;
    let get = |i: usize| m.get(i).map(|g| g.as_str());

    let date = NaiveDate::from_ymd_opt(
        get(1)?.parse().ok()?,
        get(2)?.parse().ok()?,
        get(3)?.parse().ok()?,
    )?;
    let time = date.and_hms_opt(
        get(4)?.parse().ok()?,
        get(5)?.parse().ok()?,
        get(6)?.parse().ok()?,
    )?;
    let mut nanos: u32 = 0;
    if let Some(frac) = get(7) {
        let padded = format!("{:0<9}", frac);
        nanos = padded.parse().ok()?;
    }
    let base = Utc.from_utc_datetime(&time) + chrono::Duration::nanoseconds(nanos as i64);

    let mut offset_seconds: i64 = 0;
    if let Some(off) = get(8) {
        if off != "Z" && off != "z" {
            let sign: i64 = if off.starts_with('-') { -1 } else { 1 };
            let digits: String = off[1..].chars().filter(|c| *c != ':').collect();
            if digits.len() != 4 {
                return None;
            }
            let hours: i64 = digits[..2].parse().ok()?;
            let minutes: i64 = digits[2..].parse().ok()?;
            offset_seconds = sign * (hours * 3600 + minutes * 60);
        }
    }
    Some(base - chrono::Duration::seconds(offset_seconds))
}

pub fn sqlite_string(dt: &DateTime<Utc>) -> String {
    format!("{}+00:00", dt.format("%Y-%m-%dT%H:%M:%S%.6f"))
}

pub fn json_string(dt: &DateTime<Utc>) -> String {
    format!("{}Z", dt.format("%Y-%m-%dT%H:%M:%S%.3f"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_z_suffix() {
        let d = parse("2026-06-12T08:30:00.123Z").unwrap();
        assert_eq!(json_string(&d), "2026-06-12T08:30:00.123Z");
    }

    #[test]
    fn parses_space_separator_and_micros() {
        let d = parse("2026-06-12 08:30:00.123456+00:00").unwrap();
        assert_eq!(sqlite_string(&d), "2026-06-12T08:30:00.123456+00:00");
    }

    #[test]
    fn parses_offset_and_normalizes_to_utc() {
        let d = parse("2026-06-12T16:30:00+08:00").unwrap();
        assert_eq!(json_string(&d), "2026-06-12T08:30:00.000Z");
    }

    #[test]
    fn parses_missing_offset_as_utc() {
        let d = parse("2026-06-12T08:30:00").unwrap();
        assert_eq!(json_string(&d), "2026-06-12T08:30:00.000Z");
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse("not-a-date").is_none());
        assert!(parse("2026-13-01T00:00:00Z").is_none());
    }

    #[test]
    fn round_trip_sqlite_format() {
        let now = Utc::now();
        let s = sqlite_string(&now);
        let back = parse(&s).unwrap();
        // 微秒精度内一致
        assert!((back - now).num_microseconds().unwrap().abs() <= 1);
    }

    #[test]
    fn sqlite_string_ordering_matches_time_ordering() {
        let a = parse("2026-01-02T00:00:00.000001Z").unwrap();
        let b = parse("2026-01-02T00:00:00.000002Z").unwrap();
        assert!(sqlite_string(&a) < sqlite_string(&b));
    }
}
