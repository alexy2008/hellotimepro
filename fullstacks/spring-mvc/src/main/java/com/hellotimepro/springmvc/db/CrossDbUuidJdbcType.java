package com.hellotimepro.springmvc.db;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.UUID;
import org.hibernate.dialect.Dialect;
import org.hibernate.type.descriptor.ValueBinder;
import org.hibernate.type.descriptor.ValueExtractor;
import org.hibernate.type.descriptor.WrapperOptions;
import org.hibernate.type.descriptor.java.JavaType;
import org.hibernate.type.descriptor.jdbc.BasicExtractor;
import org.hibernate.type.descriptor.jdbc.VarcharJdbcType;

/**
 * 跨库 UUID 映射，靠 {@code @JdbcType} 强制作用在实体的 UUID 字段上（方言级注册会被
 * community SQLiteDialect 的 UUID→VARCHAR 解析绕过，故改用注解）。运行时按方言分流：
 *
 * <ul>
 *   <li><b>SQLite</b>：列是 TEXT，seed 以 32 位无横线 hex 写入（对齐参考栈 SQLAlchemy {@code Uuid()}
 *       的非 PG 行为）。这里按 32 位 hex 读写，读时兼容带/不带横线。</li>
 *   <li><b>Postgres</b>：原生 {@code uuid} 列，用 {@code setObject/getObject} 直传 {@link UUID}。</li>
 * </ul>
 */
public final class CrossDbUuidJdbcType extends VarcharJdbcType {
  public CrossDbUuidJdbcType() {}

  private static boolean isSqlite(WrapperOptions options) {
    Dialect dialect = options.getSessionFactory().getJdbcServices().getDialect();
    return dialect instanceof org.hibernate.community.dialect.SQLiteDialect;
  }

  private static String toHex(UUID value) {
    return value.toString().replace("-", "");
  }

  private static UUID fromHex(String raw) {
    if (raw == null) {
      return null;
    }
    String s = raw.trim();
    if (s.length() == 32) {
      s = s.substring(0, 8) + '-' + s.substring(8, 12) + '-' + s.substring(12, 16)
          + '-' + s.substring(16, 20) + '-' + s.substring(20);
    }
    return UUID.fromString(s);
  }

  @Override
  public <X> ValueBinder<X> getBinder(JavaType<X> javaType) {
    // 自实现 ValueBinder：null 按方言给出正确的 setNull 类型（Postgres 用 OTHER 对应 uuid 列）。
    return new ValueBinder<>() {
      @Override
      public void bind(PreparedStatement st, X value, int index, WrapperOptions options)
          throws SQLException {
        if (value == null) {
          st.setNull(index, isSqlite(options) ? Types.VARCHAR : Types.OTHER);
        } else if (isSqlite(options)) {
          st.setString(index, toHex(javaType.unwrap(value, UUID.class, options)));
        } else {
          st.setObject(index, javaType.unwrap(value, UUID.class, options));
        }
      }

      @Override
      public void bind(CallableStatement st, X value, String name, WrapperOptions options)
          throws SQLException {
        if (value == null) {
          st.setNull(name, isSqlite(options) ? Types.VARCHAR : Types.OTHER);
        } else if (isSqlite(options)) {
          st.setString(name, toHex(javaType.unwrap(value, UUID.class, options)));
        } else {
          st.setObject(name, javaType.unwrap(value, UUID.class, options));
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
          return javaType.wrap(fromHex(rs.getString(paramIndex)), options);
        }
        return javaType.wrap(rs.getObject(paramIndex, UUID.class), options);
      }

      @Override
      protected X doExtract(CallableStatement st, int index, WrapperOptions options)
          throws SQLException {
        if (isSqlite(options)) {
          return javaType.wrap(fromHex(st.getString(index)), options);
        }
        return javaType.wrap(st.getObject(index, UUID.class), options);
      }

      @Override
      protected X doExtract(CallableStatement st, String name, WrapperOptions options)
          throws SQLException {
        if (isSqlite(options)) {
          return javaType.wrap(fromHex(st.getString(name)), options);
        }
        return javaType.wrap(st.getObject(name, UUID.class), options);
      }
    };
  }
}
