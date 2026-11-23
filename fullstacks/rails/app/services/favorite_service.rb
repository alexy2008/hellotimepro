module FavoriteService
  module_function

  def add_favorite(user, capsule_id_raw)
    capsule_id = Validation.uuid(capsule_id_raw, "capsuleId")

    # favorite_count 是冗余计数器，必须与 favorites 行变更同处一个事务。
    # Postgres 路径取胶囊行写锁；SQLite 依赖单写事务与原子提交。
    ActiveRecord::Base.transaction do
      capsule = Capsule.row_lock(Capsule.by_uuid(capsule_id)).first or raise ApiError.not_found("胶囊不存在")

      existing = Favorite.find_by(user_id: user.id, capsule_id: capsule.id)
      if existing
        next { capsuleId: capsule.id.to_s, favoriteCount: capsule.favorite_count,
               favoritedAt: CrossDb.iso_instant(existing.created_at) }
      end

      now = Time.now.utc
      Favorite.create!(user_id: user.id, capsule_id: capsule.id, created_at: now)
      capsule.update!(favorite_count: capsule.favorite_count + 1)
      { capsuleId: capsule.id.to_s, favoriteCount: capsule.favorite_count, favoritedAt: CrossDb.iso_instant(now) }
    end
  end

  def remove_favorite(user, capsule_id_raw)
    capsule_id = Validation.uuid(capsule_id_raw, "capsuleId")

    ActiveRecord::Base.transaction do
      capsule = Capsule.row_lock(Capsule.by_uuid(capsule_id)).first
      next if capsule.nil?

      deleted = Favorite.where(user_id: user.id, capsule_id: capsule.id).delete_all
      if deleted.positive?
        capsule.update!(favorite_count: [capsule.favorite_count - 1, 0].max)
      end
    end
  end
end
