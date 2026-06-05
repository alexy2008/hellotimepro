package com.hellotimepro.springmvc.db;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import org.hibernate.dialect.Dialect;
import org.hibernate.type.descriptor.ValueBinder;
import org.hibernate.type.descriptor.ValueExtractor;
import org.hibernate.type.descriptor.WrapperOptions;
import org.hibernate.type.descriptor.java.JavaType;
import org.hibernate.type.descriptor.jdbc.BasicExtractor;
import org.hibernate.type.descriptor.jdbc.VarcharJdbcType;

/**
 * 跨库 {@link OffsetDateTime} 映射，靠 {@code @JdbcType} 强制作用在实体的时间戳字段上。运行时按方言分流：
 *
 * <ul>
 *   <li><b>SQLite</b>：列是 TEXT，spec/seed 约定存 ISO-8601（UTC、{@code +00:00} 偏移）。
 *       xerial sqlite-jdbc 的 {@code getTimestamp} 无法解析带 {@code T}/偏移的字符串，故直接以 TEXT 读写。
 *       写出格式与 seed 完全一致，保证按字符串比较的 {@code open_at <= :now}、{@code ORDER BY created_at} 正确。</li>
 *   <li><b>Postgres</b>：原生 {@code timestamptz}，用 {@code setObject/getObject} 直传 {@link OffsetDateTime}。</li>
 * </ul>
 */
public final class CrossDbOffsetDateTimeJdbcType extends VarcharJdbcType {

  /** 与 seed 对齐：始终输出秒、可选小数秒，零偏移渲染成 {@code +00:00}（而非 ISO 默认的 Z）。 */
  private static final DateTimeFormatter WRITE = new DateTimeFormatterBuilder()
      .appendPattern("yyyy-MM-dd'T'HH:mm:ss")
      .optionalStart().appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true).optionalEnd()
      .appendOffset("+HH:MM", "+00:00")
      .toFormatter();

  public CrossDbOffsetDateTimeJdbcType() {}

  private static boolean isSqlite(WrapperOptions options) {
    Dialect dialect = options.getSessionFactory().getJdbcServices().getDialect();
    return dialect instanceof org.hibernate.community.dialect.SQLiteDialect;
  }

  private static String toIso(OffsetDateTime value) {
    return value.withOffsetSameInstant(ZoneOffset.UTC).format(WRITE);
  }

  private static OffsetDateTime fromIso(String raw) {
    if (raw == null) {
      return null;
    }
    String s = raw.trim();
    // 容错：旧数据可能用空格分隔（'2026-06-01 10:00:00...'）。
    if (s.length() > 10 && s.charAt(10) == ' ') {
      s = s.substring(0, 10) + 'T' + s.substring(11);
    }
    try {
      return OffsetDateTime.parse(s, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    } catch (DateTimeParseException noOffset) {
      // 没有偏移信息时按 UTC 处理。
      return LocalDateTime.parse(s, DateTimeFormatter.ISO_LOCAL_DATE_TIME).atOffset(ZoneOffset.UTC);
    }
  }

  @Override
  public <X> ValueBinder<X> getBinder(JavaType<X> javaType) {
    // 自实现 ValueBinder：null 也要按方言给出正确的 setNull 类型，
    // 否则 Postgres 会把 VARCHAR null 写入 timestamptz 列而报类型错误。
    return new ValueBinder<>() {
      @Override
      public void bind(PreparedStatement st, X value, int index, WrapperOptions options)
          throws SQLException {
        if (value == null) {
          st.setNull(index, isSqlite(options) ? Types.VARCHAR : Types.TIMESTAMP_WITH_TIMEZONE);
        } else if (isSqlite(options)) {
          st.setString(index, toIso(javaType.unwrap(value, OffsetDateTime.class, options)));
        } else {
          st.setObject(index, javaType.unwrap(value, OffsetDateTime.class, options));
        }
      }

      @Override
      public void bind(CallableStatement st, X value, String name, WrapperOptions options)
          throws SQLException {
        if (value == null) {
          st.setNull(name, isSqlite(options) ? Types.VARCHAR : Types.TIMESTAMP_WITH_TIMEZONE);
        } else if (isSqlite(options)) {
          st.setString(name, toIso(javaType.unwrap(value, OffsetDateTime.class, options)));
        } else {
          st.setObject(name, javaType.unwrap(value, OffsetDateTime.class, options));
        }
      }
    };
  }

  @Override
  public <X> ValueExtractor<X> getExtractor(JavaType<X> javaType) {
    return new BasicExtractor<>(javaType, this) {
      @Override
      protected X doExtract(ResultSet rs, int paramIndex, WrapperOptions options)
          throws SQLException {
        if (isSqlite(options)) {
          return javaType.wrap(fromIso(rs.getString(paramIndex)), options);
        }
        return javaType.wrap(rs.getObject(paramIndex, OffsetDateTime.class), options);
      }

      @Override
      protected X doExtract(CallableStatement st, int index, WrapperOptions options)
          throws SQLException {
        if (isSqlite(options)) {
          return javaType.wrap(fromIso(st.getString(index)), options);
        }
        return javaType.wrap(st.getObject(index, OffsetDateTime.class), options);
      }

      @Override
      protected X doExtract(CallableStatement st, String name, WrapperOptions options)
          throws SQLException {
        if (isSqlite(options)) {
          return javaType.wrap(fromIso(st.getString(name)), options);
        }
        return javaType.wrap(st.getObject(name, OffsetDateTime.class), options);
      }
    };
  }
}
