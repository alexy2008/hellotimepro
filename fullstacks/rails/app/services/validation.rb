require "time"

# 手写字段校验。失败统一抛 VALIDATION_ERROR → 422，正则/长度约束与 spec/openapi.yaml 一致。
module Validation
  module_function

  EMAIL = /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/
  PASSWORD = /\A(?=.*[A-Za-z])(?=.*\d).{8,128}\z/
  NICKNAME = /\A[\p{L}\p{N}_-]{2,20}\z/
  AVATAR = /\A[a-z0-9-]{2,20}\z/
  CODE = /\A[A-Za-z0-9]{8}\z/

  def email(value)
    e = value.to_s.strip
    if e.empty? || e.length > 254 || !EMAIL.match?(e)
      raise ApiError.validation("邮箱格式不正确", "email")
    end
    e
  end

  def require_non_blank(value, field)
    raise ApiError.validation("#{field} 不能为空", field) if value.nil? || value.to_s.strip.empty?

    value
  end

  def password(value, field = "password")
    unless value.is_a?(String) && PASSWORD.match?(value)
      raise ApiError.validation("密码至少 8 位且需包含字母和数字", field)
    end
    value
  end

  def nickname(value)
    unless value.is_a?(String) && NICKNAME.match?(value)
      raise ApiError.validation("昵称需为 2-20 位字母/数字/下划线/连字符", "nickname")
    end
    value
  end

  def avatar_format(value)
    unless value.is_a?(String) && AVATAR.match?(value)
      raise ApiError.validation("头像 ID 格式不正确", "avatarId")
    end
    value
  end

  def title(value)
    unless value.is_a?(String) && !value.empty? && value.length <= 60
      raise ApiError.validation("标题长度需为 1-60", "title")
    end
    value
  end

  def content(value)
    unless value.is_a?(String) && !value.empty? && value.length <= 5000
      raise ApiError.validation("内容长度需为 1-5000", "content")
    end
    value
  end

  def open_at(value)
    raise ApiError.validation("openAt 不能为空", "openAt") if value.nil? || value.to_s.strip.empty?

    Time.iso8601(value.to_s).utc
  rescue ArgumentError
    raise ApiError.validation("openAt 必须是 ISO-8601 时间", "openAt")
  end

  def code(value)
    raise ApiError.validation("code 必须为 8 位字母数字", "code") unless CODE.match?(value.to_s)

    value
  end

  def page!(page, page_size)
    raise ApiError.validation("page 必须 >= 1", "page") if page < 1
    raise ApiError.validation("pageSize 范围 1-50", "pageSize") if page_size < 1 || page_size > 50
  end
end
