# 领域模型 → API 响应 hash（键即契约字段；时间统一 ISO-8601 UTC ...Z）。
module MapperService
  module_function

  def user(u)
    {
      id: u.id.to_s,
      email: u.email,
      nickname: u.nickname,
      avatarId: u.avatar_id,
      createdAt: CrossDb.iso_instant(u.created_at),
    }
  end

  def user_brief(owner)
    { nickname: owner.nickname, avatarId: owner.avatar_id }
  end

  def detail(capsule, owner, favorited_by_me:, include_content: true)
    opened = opened?(capsule.open_at)
    {
      id: capsule.id.to_s,
      code: capsule.code,
      title: capsule.title,
      creator: user_brief(owner),
      openAt: CrossDb.iso_instant(capsule.open_at),
      createdAt: CrossDb.iso_instant(capsule.created_at),
      inPlaza: capsule.in_plaza,
      favoriteCount: capsule.favorite_count,
      isOpened: opened,
      content: opened && include_content ? capsule.content : nil,
      favoritedByMe: favorited_by_me,
    }
  end

  def list_item(capsule, owner, favorited_by_me:, favorited_at: nil)
    opened = opened?(capsule.open_at)
    preview = nil
    if opened
      raw = capsule.content.to_s.strip
      preview = raw.length > 80 ? "#{raw[0, 80]}…" : raw
    end
    {
      id: capsule.id.to_s,
      code: capsule.code,
      title: capsule.title,
      creator: user_brief(owner),
      openAt: CrossDb.iso_instant(capsule.open_at),
      createdAt: CrossDb.iso_instant(capsule.created_at),
      inPlaza: capsule.in_plaza,
      favoriteCount: capsule.favorite_count,
      isOpened: opened,
      favoritedByMe: favorited_by_me,
      favoritedAt: favorited_at ? CrossDb.iso_instant(favorited_at) : nil,
      contentPreview: preview,
    }
  end

  def opened?(open_at)
    CrossDb.to_utc(open_at) <= Time.now.utc
  end
end
