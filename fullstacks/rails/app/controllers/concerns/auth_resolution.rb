# 从 Authorization 头解析 Bearer JWT 并加载当前用户。供 API 控制器复用。
module AuthResolution
  extend ActiveSupport::Concern

  # 匿名可访问端点：无 / 非法 token 返回 nil。
  def optional_user(authorization)
    token = parse_bearer(authorization)
    return nil if token.nil?

    decoded = SecurityService.decode_access_token(token)
    return nil if decoded.subject.nil?

    id = CrossDb.parse_uuid_or_nil(decoded.subject)
    id ? User.find_by(id: id) : nil
  end

  # 受保护端点：缺失 / 过期 / 非法 → UNAUTHORIZED。
  def require_user!(authorization)
    token = parse_bearer(authorization) or raise ApiError.unauthorized("缺少 access token")
    decoded = SecurityService.decode_access_token(token)
    raise ApiError.unauthorized(decoded.error || "invalid_token") if decoded.subject.nil?

    id = CrossDb.parse_uuid_or_nil(decoded.subject) or raise ApiError.unauthorized("invalid_token")
    User.find_by(id: id) or raise ApiError.unauthorized("用户不存在")
  end

  def parse_bearer(authorization)
    return nil if authorization.nil? || authorization.strip.empty?

    parts = authorization.strip.split(/\s+/, 2)
    return nil unless parts.size == 2 && parts[0].casecmp?("bearer")

    parts[1].strip
  end
end
