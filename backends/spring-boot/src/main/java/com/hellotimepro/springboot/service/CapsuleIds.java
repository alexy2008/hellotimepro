package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.dto.Dtos;
import com.hellotimepro.springboot.web.ApiException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 胶囊 UUID 的统一解析：格式不合法一律 422 VALIDATION_ERROR，与 fastapi 的 uuid 路径参数一致。
 *
 * <p>不直接用 {@code UUID.fromString}：它对非法输入抛 IllegalArgumentException（会落到通用处理器变成 500），
 * 而且过于宽松（"1-1-1-1-1" 也能解析）。
 */
public final class CapsuleIds {
  private static final Pattern FORMAT = Pattern.compile(Dtos.UUID_PATTERN);

  private CapsuleIds() {}

  public static UUID parse(String raw, String field) {
    if (raw == null || !FORMAT.matcher(raw).matches()) {
      throw ApiException.validation(field + " 必须是有效的 UUID", field);
    }
    return UUID.fromString(raw);
  }
}
