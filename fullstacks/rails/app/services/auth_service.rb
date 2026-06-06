# 注册 / 登录 / 刷新（轮转 + 家族吊销）/ 登出 / 改密码。
module AuthService
  module_function

  def register(params)
    email = Validation.email(params[:email]).downcase
    raw_password = Validation.password(params[:password])
    nickname = Validation.nickname(params[:nickname])
    avatar_id = Validation.avatar_format(params[:avatarId])
    raise ApiError.validation("头像 ID 不存在", "avatarId") unless AvatarService.exists?(avatar_id)

    raise ApiError.conflict("邮箱已被注册", "email") if User.exists?(email: email)
    raise ApiError.conflict("昵称已被使用", "nickname") if User.exists?(nickname: nickname)

    user = nil
    tokens = nil
    ActiveRecord::Base.transaction do
      user = User.create!(
        email: email,
        password_hash: SecurityService.hash_password(raw_password),
        nickname: nickname,
        avatar_id: avatar_id,
      )
      tokens = issue_token_pair(user, nil)
    end
    tokens
  end

  def login(params)
    email = Validation.email(params[:email]).downcase
    pwd = Validation.require_non_blank(params[:password], "password")
    LoginRateLimiter.check!(email)

    user = User.find_by(email: email)
    if user.nil? || !SecurityService.verify_password(pwd, user.password_hash)
      LoginRateLimiter.record_failure(email)
      raise ApiError.unauthorized("邮箱或密码错误")
    end
    ActiveRecord::Base.transaction { issue_token_pair(user, nil) }
  end

  def refresh(raw_refresh)
    raw = Validation.require_non_blank(raw_refresh, "refreshToken")
    token_hash = SecurityService.hash_refresh_token(raw)

    outcome = :invalid
    tokens = nil
    ActiveRecord::Base.transaction do
      rel = RefreshToken.where(token_hash: token_hash)
      rel = rel.lock unless AppConfig.sqlite?
      row = rel.first
      now = Time.now.utc
      if row.nil? || CrossDb.to_utc(row.expires_at) <= now
        outcome = :invalid
      elsif row.revoked_at
        RefreshToken.where(family_id: row.family_id, revoked_at: nil)
                    .update_all(["revoked_at = ?", db_time(now)])
        outcome = :reused
      else
        user = User.find_by(id: row.user_id)
        if user.nil?
          outcome = :invalid
        else
          row.update!(revoked_at: now)
          tokens = issue_token_pair(user, row.family_id)
          outcome = :success
        end
      end
    end

    case outcome
    when :success then tokens
    when :reused then raise ApiError.unauthorized("refresh token 已失效")
    else raise ApiError.unauthorized("refresh token 无效")
    end
  end

  def logout(raw_refresh)
    return if raw_refresh.nil? || raw_refresh.to_s.strip.empty?

    row = RefreshToken.find_by(token_hash: SecurityService.hash_refresh_token(raw_refresh))
    row.update!(revoked_at: Time.now.utc) if row && row.revoked_at.nil?
  end

  def change_password(user, params)
    Validation.require_non_blank(params[:currentPassword], "currentPassword")
    new_password = Validation.password(params[:newPassword], "newPassword")
    unless SecurityService.verify_password(params[:currentPassword], user.password_hash)
      raise ApiError.unauthorized("当前密码错误")
    end
    ActiveRecord::Base.transaction do
      user.update!(password_hash: SecurityService.hash_password(new_password), updated_at: Time.now.utc)
      RefreshToken.where(user_id: user.id, revoked_at: nil)
                  .update_all(["revoked_at = ?", db_time(Time.now.utc)])
    end
  end

  # 在当前事务内签发 access + refresh 对，并落库 refresh token 行。
  def issue_token_pair(user, family_id)
    access = SecurityService.create_access_token(user)
    refresh = SecurityService.generate_refresh_token
    now = Time.now.utc
    RefreshToken.create!(
      user_id: user.id,
      token_hash: SecurityService.hash_refresh_token(refresh),
      family_id: family_id || SecureRandom.uuid,
      expires_at: now + AppConfig.refresh_token_ttl_seconds,
      created_at: now,
    )
    {
      accessToken: access,
      refreshToken: refresh,
      accessTokenExpiresIn: AppConfig.access_token_ttl_seconds,
      refreshTokenExpiresIn: AppConfig.refresh_token_ttl_seconds,
      user: MapperService.user(user),
    }
  end

  # 时间戳裸 SQL 绑定值：SQLite 用 ISO 字符串、Postgres 用 Time。
  def db_time(t)
    AppConfig.sqlite? ? CrossDb.format_timestamp(t) : t
  end
end
