package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.service.AvatarService;
import com.hellotimepro.springmvc.service.AvatarService.AvatarMeta;
import java.text.NumberFormat;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

/**
 * Thymeleaf 模板格式化与视觉图元辅助 Bean（通过 {@code ${@fmt.xxx(...)}} 调用）。
 *
 * <p>集中承载线性 SVG 图标、v2 头像内联路径、琥珀 FNV-1a 专属配色、火漆曲线与时间文案算法，
 * 使服务端首屏直出 HTML 与 React 2.0 参考实现逐像素一致，同时保持模板简洁易读。
 */
@Component("fmt")
public class Fmt {
  private static final DateTimeFormatter DOT_DATE = DateTimeFormatter.ofPattern("yyyy.MM.dd");
  private static final DateTimeFormatter DOT_DATETIME = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");
  private static final DateTimeFormatter DASH_DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
  private static final DateTimeFormatter TIME_HM = DateTimeFormatter.ofPattern("HH:mm");
  private static final DateTimeFormatter TIME_HMS = DateTimeFormatter.ofPattern("HH:mm:ss");
  private static final String[] WEEK = {"一", "二", "三", "四", "五", "六", "日"};

  private static final String WAX_OUT = blobPath(50, 50, 46, 18, 0.055, 21);
  private static final String WAX_IN = blobPath(50, 50, 43.5, 14, 0.03, 8);
  private static final AtomicLong UID = new AtomicLong(1000);

  private static final Map<String, String> ICONS = Map.ofEntries(
      Map.entry("arrow", "<path d=\"M5 12h14M13 6l6 6-6 6\"/>"),
      Map.entry("arrow-left", "<path d=\"M19 12H5M11 6l-6 6 6 6\"/>"),
      Map.entry("search", "<circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m16 16 4.5 4.5\"/>"),
      Map.entry("heart", "<path d=\"M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z\"/>"),
      Map.entry("key", "<circle cx=\"7.5\" cy=\"16.5\" r=\"4\"/><path d=\"M10.4 13.6 20 4M17 7l2.5 2.5M14.2 9.8l2 2\"/>"),
      Map.entry("copy", "<rect x=\"8.5\" y=\"8.5\" width=\"11\" height=\"11\" rx=\"1.5\"/><path d=\"M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5\"/>"),
      Map.entry("link", "<path d=\"M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2\"/><path d=\"M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2\"/>"),
      Map.entry("sun", "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7\"/>"),
      Map.entry("moon", "<path d=\"M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z\"/>"),
      Map.entry("plus", "<path d=\"M12 5v14M5 12h14\"/>"),
      Map.entry("x", "<path d=\"M6 6l12 12M18 6 6 18\"/>"),
      Map.entry("check", "<path d=\"m5 12.5 4.5 4.5L19 7.5\"/>"),
      Map.entry("chev-down", "<path d=\"m6 9 6 6 6-6\"/>"),
      Map.entry("chev-left", "<path d=\"m15 6-6 6 6 6\"/>"),
      Map.entry("chev-right", "<path d=\"m9 6 6 6-6 6\"/>"),
      Map.entry("user", "<circle cx=\"12\" cy=\"8.5\" r=\"3.8\"/><path d=\"M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5\"/>"),
      Map.entry("logout", "<path d=\"M10 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h4\"/><path d=\"M10 12h9.5M16 8l4 4-4 4\"/>"),
      Map.entry("sliders", "<path d=\"M4 7h10M18 7h2M4 17h2M10 17h10\"/><circle cx=\"16\" cy=\"7\" r=\"2\"/><circle cx=\"8\" cy=\"17\" r=\"2\"/>"),
      Map.entry("pen", "<path d=\"M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z\"/><path d=\"m14.5 6 3 3\"/>"),
      Map.entry("sparkle", "<path d=\"M12 3.5 13.6 9a2 2 0 0 0 1.4 1.4L20.5 12 15 13.6a2 2 0 0 0-1.4 1.4L12 20.5 10.4 15A2 2 0 0 0 9 13.6L3.5 12 9 10.4A2 2 0 0 0 10.4 9L12 3.5z\"/>"),
      Map.entry("refresh", "<path d=\"M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9\"/><path d=\"M18 3.5v4h-4M6 20.5v-4h4\"/>"),
      Map.entry("trash", "<path d=\"M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10 10.5v6M14 10.5v6\"/>"),
      Map.entry("eye", "<path d=\"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>"),
      Map.entry("eye-off", "<path d=\"M4 4l16 16M9.9 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7M6.3 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.6-.8M9.9 9.9a3 3 0 0 0 4.2 4.2\"/>"),
      Map.entry("compass", "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"m15.5 8.5-2 5-5 2 2-5 5-2z\"/>"),
      Map.entry("clock", "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 7v5l3.5 2\"/>"),
      Map.entry("lock", "<rect x=\"5\" y=\"10.5\" width=\"14\" height=\"10\" rx=\"1.5\"/><path d=\"M8 10.5V8a4 4 0 0 1 8 0v2.5\"/>"),
      Map.entry("globe", "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z\"/>"),
      Map.entry("info", "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 11v5.5M12 7.6v.2\"/>"),
      Map.entry("alert", "<path d=\"M12 4 21 19.5H3L12 4z\"/><path d=\"M12 10v4.5M12 17v.2\"/>"),
      Map.entry("mail", "<rect x=\"3.5\" y=\"5.5\" width=\"17\" height=\"13\" rx=\"1.5\"/><path d=\"m4 6.5 8 6.5 8-6.5\"/>"),
      Map.entry("grid", "<path d=\"M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z\"/>"),
      Map.entry("paste", "<rect x=\"6\" y=\"5\" width=\"12\" height=\"15.5\" rx=\"1.5\"/><path d=\"M9.5 5V3.5h5V5M9 10h6M9 13.5h6M9 17h3.5\"/>"),
      Map.entry("external", "<path d=\"M13 5h6v6M19 5l-8.5 8.5M10 6H6.5A1.5 1.5 0 0 0 5 7.5v10A1.5 1.5 0 0 0 6.5 19h10a1.5 1.5 0 0 0 1.5-1.5V14\"/>"),
      Map.entry("calendar", "<rect x=\"4\" y=\"5.5\" width=\"16\" height=\"14.5\" rx=\"1.5\"/><path d=\"M4 10h16M8.5 3.5v4M15.5 3.5v4\"/>"),
      Map.entry("fire", "<path d=\"M12 21c3.6 0 6.5-2.6 6.5-6.3 0-4.2-3.4-5.7-3.8-9.7-2.2 1-3.9 3.2-4 5.6-1-.6-1.6-1.7-1.7-2.8C7 9.3 5.5 11.7 5.5 14.7 5.5 18.4 8.4 21 12 21z\"/>"),
      Map.entry("book", "<path d=\"M5 4.5h11A2.5 2.5 0 0 1 18.5 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5z\"/><path d=\"M5 17a2.5 2.5 0 0 1 2.5-2.5h11\"/>"),
      Map.entry("hourglass", "<path d=\"M6.5 3.5h11M6.5 20.5h11M7.5 3.5c0 5 9 6 9 8.5s-9 3.5-9 8.5M16.5 3.5c0 5-9 6-9 8.5s9 3.5 9 8.5\"/>"),
      Map.entry("mail-open", "<path d=\"M3.5 10 12 4.5l8.5 5.5v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z\"/><path d=\"m3.8 10.2 8.2 5.3 8.2-5.3\"/>"),
      Map.entry("unlock", "<rect x=\"5\" y=\"10.5\" width=\"14\" height=\"10\" rx=\"1.5\"/><path d=\"M8 10.5V8a4 4 0 0 1 7.6-1.8\"/>"),
      Map.entry("feather", "<path d=\"M20 4c-6 0-11.5 4.5-12.5 11.5L5 20\"/><path d=\"M8 15.5h6.5M11 11.5h6\"/>"),
      Map.entry("layers", "<path d=\"m12 3.5 8.5 4.5-8.5 4.5L3.5 8z\"/><path d=\"m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5\"/>"),
      Map.entry("code", "<path d=\"m8.5 7-5 5 5 5M15.5 7l5 5-5 5\"/>"),
      Map.entry("server", "<rect x=\"4\" y=\"4\" width=\"16\" height=\"7\" rx=\"1.5\"/><rect x=\"4\" y=\"13\" width=\"16\" height=\"7\" rx=\"1.5\"/><path d=\"M8 7.5h.01M8 16.5h.01\"/>"),
      Map.entry("database", "<ellipse cx=\"12\" cy=\"6\" rx=\"7.5\" ry=\"2.8\"/><path d=\"M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8\"/>"),
      Map.entry("palette", "<path d=\"M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.6-.8 1.6-1.6 0-1.3-1-1.4-1-2.6 0-.9.7-1.6 1.6-1.6h2a3.8 3.8 0 0 0 3.8-3.8c0-4.2-3.6-7.4-8-7.4z\"/><circle cx=\"7.8\" cy=\"11\" r=\"1\"/><circle cx=\"10.5\" cy=\"7.5\" r=\"1\"/><circle cx=\"15\" cy=\"7.8\" r=\"1\"/>"),
      Map.entry("shield", "<path d=\"M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z\"/><path d=\"m9 12 2.2 2.2L15.5 10\"/>")
  );

  private static final Map<String, String> ROLE_LABELS = Map.of(
      "language", "语言",
      "framework", "框架",
      "database", "数据库",
      "orm", "ORM",
      "runtime", "运行时",
      "styling", "样式",
      "build", "构建",
      "state", "状态管理",
      "template", "模板引擎",
      "enhancement", "渐进增强"
  );

  private static final Map<String, String> TECH_NOTES = Map.of(
      "Java", "运行在 JVM 上的强类型语言，一次编写处处运行",
      "Spring Boot", "Java 生态最主流的企业级框架，约定优于配置",
      "Hibernate", "JPA 规范的事实参考实现",
      "PostgreSQL", "功能丰富的开源关系型数据库",
      "SQLite", "零配置嵌入式关系型数据库，单文件事务完整",
      "Thymeleaf", "自然模板引擎，HTML 原型即服务端视图模板",
      "HTMX", "以超媒体属性驱动局部 HTML 替换，无需厚重前端运行时",
      "JavaScript", "原生渐进增强：承载精密交互与 View Transition 转场"
  );

  private final AvatarService avatarService;

  public Fmt(AvatarService avatarService) {
    this.avatarService = avatarService;
  }

  public record Palette(long hue, String capLight, String capDeep, String accent, String glow) {}
  public record Countdown(long d, String dPad, String h, String m, String s, boolean expired) {}

  public String uid(String prefix) {
    return prefix + UID.incrementAndGet();
  }

  public String icon(String name) {
    return icon(name, null);
  }

  public String icon(String name, String extraClass) {
    String path = ICONS.getOrDefault(name, "");
    String cls = (extraClass == null || extraClass.isBlank()) ? "ic" : "ic " + extraClass;
    return "<svg class=\"" + cls + "\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">" + path + "</svg>";
  }

  public AvatarMeta avatar(String id) {
    return avatarService.metaOf(id);
  }

  public String waxOut() { return WAX_OUT; }
  public String waxIn() { return WAX_IN; }

  public Palette palette(String code) {
    if (code == null || code.isBlank()) return fromHue(68, 300);
    int h = 0x811c9dc5;
    for (int i = 0; i < code.length(); i++) {
      h ^= code.charAt(i);
      h *= 0x01000193;
    }
    long u = Integer.toUnsignedLong(h);
    long hue = u % 360;
    long hue2 = (hue + 40 + ((u >>> 9) % 41)) % 360;
    return fromHue(hue, hue2);
  }

  private static Palette fromHue(long hue, long hue2) {
    return new Palette(
        hue,
        "oklch(0.84 0.14 " + hue + ")",
        "oklch(0.63 0.19 " + hue + ")",
        "oklch(0.78 0.13 " + hue2 + ")",
        "oklch(0.72 0.17 " + hue + " / 0.34)");
  }

  private static ZonedDateTime local(OffsetDateTime t) {
    return t == null ? ZonedDateTime.now(ZoneId.systemDefault()) : t.atZoneSameInstant(ZoneId.systemDefault());
  }

  public String date(OffsetDateTime t) {
    return t == null ? "" : local(t).format(DOT_DATE);
  }

  public String nowDate() {
    return ZonedDateTime.now(ZoneId.systemDefault()).format(DOT_DATE);
  }

  public String nowDashDateTime() {
    ZonedDateTime z = ZonedDateTime.now(ZoneId.systemDefault());
    return z.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
  }

  public String nowCnWeek() {
    ZonedDateTime z = ZonedDateTime.now(ZoneId.systemDefault());
    return z.getYear() + "年" + z.getMonthValue() + "月" + z.getDayOfMonth() + "日 星期"
        + WEEK[z.getDayOfWeek().getValue() - 1];
  }

  public String nowHms() {
    return ZonedDateTime.now(ZoneId.systemDefault()).format(TIME_HMS);
  }

  public String dateTime(OffsetDateTime t) {
    return t == null ? "" : local(t).format(DOT_DATETIME);
  }

  public String dashDateTime(OffsetDateTime t) {
    return t == null ? "" : local(t).format(DASH_DATETIME);
  }

  public String time(OffsetDateTime t) {
    return t == null ? "" : local(t).format(TIME_HM);
  }

  public String cnDate(OffsetDateTime t) {
    if (t == null) return "";
    ZonedDateTime z = local(t);
    return z.getYear() + "年" + z.getMonthValue() + "月" + z.getDayOfMonth() + "日";
  }

  public String full(OffsetDateTime t) {
    if (t == null) return "";
    ZonedDateTime z = local(t);
    String w = "星期" + WEEK[z.getDayOfWeek().getValue() - 1];
    return cnDate(t) + " " + w + " " + z.format(TIME_HM);
  }

  public int year(OffsetDateTime t) {
    return t == null ? ZonedDateTime.now(ZoneId.systemDefault()).getYear() : local(t).getYear();
  }

  public String heroYears() {
    int y0 = ZonedDateTime.now(ZoneId.systemDefault()).getYear();
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < 21; i++) {
      sb.append(y0 + i).append(" · ");
    }
    return sb.toString();
  }

  public String num(long n) {
    return NumberFormat.getIntegerInstance(Locale.CHINA).format(n);
  }

  public String span(OffsetDateTime from, OffsetDateTime to) {
    if (from == null || to == null) return "";
    return spanMillis(Duration.between(from, to).toMillis());
  }

  public String spanUntil(OffsetDateTime target) {
    if (target == null) return "";
    return spanMillis(Duration.between(OffsetDateTime.now(ZoneOffset.UTC), target).toMillis());
  }

  public String spanMillis(long ms) {
    long m = Math.max(0, Math.round(ms / 60000.0));
    if (m < 1) return "不到 1 分钟";
    if (m < 60) return m + " 分钟";
    if (m < 1440) {
      long h = m / 60;
      long r = m % 60;
      return (r > 0 && h < 6) ? (h + " 小时 " + r + " 分") : (Math.round(m / 60.0) + " 小时");
    }
    long days = Math.round(m / 1440.0);
    if (days < 60) return days + " 天";
    if (days < 360) return Math.round(days / 30.44) + " 个月";
    long y = (long) Math.floor(days / 365.25);
    long mo = Math.round((days - y * 365.25) / 30.44);
    if (mo >= 12) {
      y += 1;
      mo = 0;
    }
    if (y == 0) return "1 年";
    return mo > 0 ? (y + " 年 " + mo + " 个月") : (y + " 年");
  }

  public int progress(OffsetDateTime createdAt, OffsetDateTime openAt) {
    if (createdAt == null || openAt == null) return 0;
    long span = Duration.between(createdAt, openAt).toMillis();
    if (span <= 0) return 100;
    long elapsed = Duration.between(createdAt, OffsetDateTime.now(ZoneOffset.UTC)).toMillis();
    int pct = (int) Math.round((elapsed * 100.0) / span);
    return Math.max(0, Math.min(100, pct));
  }

  public String progressBarWidth(OffsetDateTime createdAt, OffsetDateTime openAt) {
    return Math.max(2, progress(createdAt, openAt)) + "%";
  }

  public String vaultStrokeDash(OffsetDateTime createdAt, OffsetDateTime openAt) {
    double c = 2 * Math.PI * 150.0;
    double pct = 0;
    if (createdAt != null && openAt != null) {
      long span = Duration.between(createdAt, openAt).toMillis();
      if (span > 0) {
        long elapsed = Duration.between(createdAt, OffsetDateTime.now(ZoneOffset.UTC)).toMillis();
        pct = Math.max(0.0, Math.min(100.0, (elapsed * 100.0) / span));
      } else {
        pct = 100.0;
      }
    }
    return String.format(Locale.ROOT, "%.1f %.1f", (c * pct) / 100.0, c);
  }

  public String vaultPctText(OffsetDateTime createdAt, OffsetDateTime openAt) {
    double pct = 0;
    if (createdAt != null && openAt != null) {
      long span = Duration.between(createdAt, openAt).toMillis();
      if (span > 0) {
        long elapsed = Duration.between(createdAt, OffsetDateTime.now(ZoneOffset.UTC)).toMillis();
        pct = Math.max(0.0, Math.min(100.0, (elapsed * 100.0) / span));
      } else {
        pct = 100.0;
      }
    }
    return String.format(Locale.ROOT, "%.2f%%", pct);
  }

  public Countdown cd(OffsetDateTime openAt) {
    if (openAt == null) return new Countdown(0, "00", "00", "00", "00", true);
    OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
    boolean expired = !openAt.isAfter(now);
    long total = Math.max(0, Duration.between(now, openAt).getSeconds());
    long d = total / 86400;
    long h = (total % 86400) / 3600;
    long m = (total % 3600) / 60;
    long s = total % 60;
    String dPad = d > 99 ? String.valueOf(d) : pad2(d);
    return new Countdown(d, dPad, pad2(h), pad2(m), pad2(s), expired);
  }

  public String cdShortAmber(OffsetDateTime openAt) {
    Countdown c = cd(openAt);
    String hms = c.h() + ":" + c.m() + ":" + c.s();
    return c.d() > 0 ? (num(c.d()) + " 天 " + hms) : hms;
  }

  public List<String> chars(String s) {
    if (s == null) return List.of();
    List<String> out = new ArrayList<>(s.length());
    for (int i = 0; i < s.length(); i++) {
      out.add(String.valueOf(s.charAt(i)));
    }
    return out;
  }

  public String preview(String text, int maxLen) {
    if (text == null || text.isBlank()) return "";
    String clean = text.replaceAll("\\s+", " ").trim();
    if (clean.codePointCount(0, clean.length()) <= maxLen) return clean;
    int end = clean.offsetByCodePoints(0, maxLen);
    return clean.substring(0, end) + "……";
  }

  public List<List<String>> paragraphs(String content) {
    if (content == null || content.isBlank()) return List.of();
    String[] blocks = content.split("\\n{2,}");
    List<List<String>> result = new ArrayList<>();
    for (String b : blocks) {
      if (b.trim().isEmpty()) continue;
      result.add(List.of(b.split("\\n", -1)));
    }
    return result;
  }

  /** 分页页码序列：整数页码字符串或 "…"，与 React pageNumbers 一致。 */
  public List<String> pageNumbers(int page, int totalPages) {
    List<String> out = new ArrayList<>();
    int prev = 0;
    for (int i = 1; i <= totalPages; i++) {
      if (i == 1 || i == totalPages || Math.abs(i - page) <= 1) {
        if (prev > 0 && i - prev > 1) out.add("…");
        out.add(String.valueOf(i));
        prev = i;
      }
    }
    return out;
  }

  public int rankOf(String sort, int page, String q, int index) {
    boolean cleanQuery = (q == null || q.isBlank());
    if ("hot".equals(sort) && page == 1 && cleanQuery && index < 3) {
      return index + 1;
    }
    return 0;
  }

  public String roleLabel(String role) {
    return ROLE_LABELS.getOrDefault(role, role);
  }

  public String techNote(String name) {
    return TECH_NOTES.getOrDefault(name, "");
  }

  public String techShort(String name) {
    if (name == null) return "";
    String cleaned = name.replaceAll("[^A-Za-z\\u4e00-\\u9fa5]", "");
    return cleaned.substring(0, Math.min(2, cleaned.length()));
  }

  public String iso(OffsetDateTime t) {
    return t == null ? "" : t.toInstant().toString();
  }

  private static String pad2(long n) {
    return (n < 10 ? "0" : "") + n;
  }

  private static String blobPath(double cx, double cy, double r, int n, double jitter, int seed) {
    int[] state = {seed};
    double[][] pts = new double[n][2];
    for (int i = 0; i < n; i++) {
      double a = (i / (double) n) * Math.PI * 2.0;
      double rnd = nextMulberry(state);
      double rr = r * (1.0 + (rnd - 0.5) * 2.0 * jitter);
      pts[i][0] = cx + Math.cos(a) * rr;
      pts[i][1] = cy + Math.sin(a) * rr;
    }
    StringBuilder d = new StringBuilder();
    d.append(String.format(Locale.ROOT, "M%.1f,%.1f", pts[0][0], pts[0][1]));
    for (int i = 0; i < n; i++) {
      double[] p0 = pts[(i - 1 + n) % n];
      double[] p1 = pts[i];
      double[] p2 = pts[(i + 1) % n];
      double[] p3 = pts[(i + 2) % n];
      d.append(String.format(Locale.ROOT, " C%.1f,%.1f %.1f,%.1f %.1f,%.1f",
          p1[0] + (p2[0] - p0[0]) / 6.0, p1[1] + (p2[1] - p0[1]) / 6.0,
          p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0,
          p2[0], p2[1]));
    }
    return d.append("Z").toString();
  }

  private static double nextMulberry(int[] state) {
    state[0] = state[0] + 0x6d2b79f5;
    int a = state[0];
    int t = (a ^ (a >>> 15)) * (1 | a);
    t = (t + (t ^ (t >>> 7)) * (61 | t)) ^ t;
    return Integer.toUnsignedLong(t ^ (t >>> 14)) / 4294967296.0;
  }
}
