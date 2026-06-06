require "jwt"
require "bcrypt"
require "digest"
require "securerandom"

# 密码哈希（bcrypt）与 JWT（HS256）+ refresh token 生成/哈希。
module SecurityService
  module_function

  DecodeResult = Struct.new(:subject, :error)

  def hash_password(plain)
    BCrypt::Password.create(plain, cost: 10).to_s
  end

  def verify_password(plain, hashed)
    BCrypt::Password.new(hashed.to_s) == plain
  rescue BCrypt::Errors::InvalidHash
    false
  end

  def create_access_token(user)
    now = Time.now.to_i
    payload = {
      sub: user.id.to_s,
      nickname: user.nickname,
      avatarId: user.avatar_id,
      iat: now,
      exp: now + AppConfig.access_token_ttl_seconds,
    }
    JWT.encode(payload, AppConfig.jwt_secret, "HS256")
  end

  # 校验 access token。过期统一 error="access_token_expired"；其它非法 error="invalid_token"。
  def decode_access_token(token)
    payload, = JWT.decode(token, AppConfig.jwt_secret, true, algorithm: "HS256")
    DecodeResult.new(payload["sub"], payload["sub"].nil? ? "invalid_token" : nil)
  rescue JWT::ExpiredSignature
    DecodeResult.new(nil, "access_token_expired")
  rescue JWT::DecodeError, StandardError
    DecodeResult.new(nil, "invalid_token")
  end

  def generate_refresh_token
    SecureRandom.urlsafe_base64(32)
  end

  def hash_refresh_token(raw)
    Digest::SHA256.hexdigest(raw.to_s)
  end
end
