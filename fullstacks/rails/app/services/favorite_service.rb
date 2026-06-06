module FavoriteService
  module_function

  def add_favorite(user, capsule_id_raw)
    capsule_id = CrossDb.parse_uuid_or_nil(capsule_id_raw) or raise ApiError.not_found("胶囊不存在")

    # favorite_count 是冗余计数器，必须与 favorites 行变更同处一个事务。
    # Postgres 路径取胶囊行写锁；SQLite 依赖单写事务与原子提交。
    ActiveRecord::Base.transaction do
      rel = Capsule.where(id: capsule_id)
      rel = rel.lock unless AppConfig.sqlite?
      capsule = rel.first
      raise ApiError.not_found("胶囊不存在") if capsule.nil? || !capsule.in_plaza
      raise ApiError.bad_request("不能收藏自己创建的胶囊") if capsule.owner_id == user.id

      existing = Favorite.find_by(user_id: user.id, capsule_id: capsule.id)
      if existing
        next { capsuleId: capsule.id.to_s, favoriteCount: capsule.favorite_count,
               favoritedAt: CrossDb.iso_instant(existing.created_at) }
      end

      now = Time.now.utc
      Favorite.create!(user_id: user.id, capsule_id: capsule.id, created_at: now)
      Capsule.where(id: capsule.id).update_all("favorite_count = favorite_count + 1")
      new_count = Capsule.where(id: capsule.id).pick(:favorite_count) || (capsule.favorite_count + 1)
      { capsuleId: capsule.id.to_s, favoriteCount: new_count, favoritedAt: CrossDb.iso_instant(now) }
    end
  end

  def remove_favorite(user, capsule_id_raw)
    # 取消收藏幂等：胶囊不存在 / 格式非法 / 原本未收藏都返回成功（204）。
    capsule_id = CrossDb.parse_uuid_or_nil(capsule_id_raw)
    return if capsule_id.nil?

    ActiveRecord::Base.transaction do
      rel = Capsule.where(id: capsule_id)
      rel = rel.lock unless AppConfig.sqlite?
      capsule = rel.first
      next if capsule.nil?

      if Favorite.exists?(user_id: user.id, capsule_id: capsule.id)
        Favorite.where(user_id: user.id, capsule_id: capsule.id).delete_all
        Capsule.where(id: capsule.id).where("favorite_count > 0")
               .update_all("favorite_count = favorite_count - 1")
      end
    end
  end
end
