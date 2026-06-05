package com.hellotimepro.springmvc.web.view;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Component;

/**
 * 模板用格式化辅助 bean。Thymeleaf 中通过 {@code ${@fmt.xxx(...)}} 调用，
 * 集中承载头像 URL、昵称缩写、时间/倒计时格式化，避免在模板里写复杂表达式。
 */
@Component("fmt")
public class Fmt {
  private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm");
  private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy/MM/dd");

  public String avatarUrl(String avatarId) {
    if (avatarId == null || avatarId.isBlank()) return "/static/avatars/neo.svg";
    return "/static/avatars/" + avatarId + ".svg";
  }

  /** 用户 chip 内显示的昵称缩写：取前 4 个字符（与 React 参考实现一致）。 */
  public String shortName(String name) {
    if (name == null) return "";
    int end = Math.min(4, name.length());
    return name.substring(0, end);
  }

  public String dateTime(OffsetDateTime t) {
    return t == null ? "" : t.format(DATETIME);
  }

  public String date(OffsetDateTime t) {
    return t == null ? "" : t.format(DATE);
  }

  public String number(long n) {
    return String.format("%,d", n);
  }

  public Countdown countdown(OffsetDateTime openAt) {
    long diff = openAt == null ? 0
        : Math.max(0, Duration.between(OffsetDateTime.now(ZoneOffset.UTC), openAt).getSeconds());
    long days = diff / 86400;
    long hours = (diff % 86400) / 3600;
    long minutes = (diff % 3600) / 60;
    long seconds = diff % 60;
    return new Countdown(days, pad(hours), pad(minutes), pad(seconds), diff == 0);
  }

  private static String pad(long n) {
    return (n < 10 ? "0" : "") + n;
  }

  /** 倒计时拆分，供模板逐格渲染（天 / 时 / 分 / 秒）。 */
  public record Countdown(long days, String hours, String minutes, String seconds, boolean expired) {}
}
