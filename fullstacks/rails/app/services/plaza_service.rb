module PlazaService
  module_function

  def plaza_list(sort:, filter:, q:, page:, page_size:, viewer_id:, now: Time.now.utc)
    Validation.page!(page, page_size)
    raise ApiError.validation("sort 仅支持 hot/new", "sort") unless %w[hot new].include?(sort)

    scope = plaza_scope(q)
    scope = case filter
    when "all" then scope
    when "opened" then scope.opened_by(now)
    when "unopened" then scope.opening_after(now)
    else raise ApiError.validation("filter 仅支持 all/opened/unopened", "filter")
    end

    scope = scope.order(favorite_count: :desc) if sort == "hot"
    rows = page_of(scope.order(Capsule.created_at_column.desc, id: :desc), page, page_size).includes(:owner).to_a
    favorites = favorite_set(viewer_id, rows.map(&:id))
    items = rows.map do |capsule|
      MapperService.list_item(capsule, capsule.owner, favorited_by_me: favorites.include?(capsule.id), now: now)
    end
    { items: items, pagination: pagination(scope.count, page, page_size) }
  end

  def plaza_stats(q:, now: Time.now.utc)
    scope = plaza_scope(q)
    opened, unopened = counts_by_opening(scope, now)
    public_capsules = Capsule.published
    {
      counts: { all: opened + unopened, opened: opened, unopened: unopened },
      farthestOpenAt: CrossDb.iso_instant(public_capsules.order(Capsule.open_at_column.desc).pick(:open_at)),
      nextOpenAt: CrossDb.iso_instant(public_capsules.opening_after(now).order(Capsule.open_at_column.asc).pick(:open_at)),
    }
  end

  def my_stats(user, now: Time.now.utc)
    owned = Capsule.where(owner_id: user.id)
    opened, unopened = counts_by_opening(owned, now)
    {
      created: opened + unopened, opened: opened, unopened: unopened,
      inPlaza: owned.published.count, favoritesReceived: owned.sum(:favorite_count),
      favoritesGiven: Favorite.where(user_id: user.id).count,
    }
  end

  def my_capsules(user, page, page_size, limit: page_size)
    Validation.page!(page, page_size)
    scope = Capsule.where(owner_id: user.id)
    rows = page_of(scope.order(Capsule.created_at_column.desc, id: :desc), page, page_size).limit(limit).to_a
    favorites = favorite_set(user.id, rows.map(&:id))
    items = rows.map { |capsule| MapperService.list_item(capsule, user, favorited_by_me: favorites.include?(capsule.id)) }
    { items: items, pagination: pagination(scope.count, page, page_size) }
  end

  def my_favorites(user, page, page_size, limit: page_size)
    Validation.page!(page, page_size)
    scope = Favorite.where(user_id: user.id)
    ordered = scope.order(CrossDb.time_column("favorites.created_at").desc, capsule_id: :desc)
    rows = page_of(ordered, page, page_size).limit(limit).includes(capsule: :owner)
    items = rows.filter_map do |favorite|
      capsule = favorite.capsule
      next unless capsule&.owner

      MapperService.list_item(capsule, capsule.owner, favorited_by_me: true, favorited_at: favorite.created_at)
    end
    { items: items, pagination: pagination(scope.count, page, page_size) }
  end

  def plaza_scope(q)
    raise ApiError.validation("q 必须是字符串", "q") unless q.nil? || q.is_a?(String)

    scope = Capsule.published.joins(:owner)
    normalized = q.to_s.strip
    return scope if normalized.empty?
    raise ApiError.validation("q 长度不得超过 50", "q") if normalized.length > 50

    pattern = "%#{Capsule.sanitize_sql_like(normalized.downcase)}%"
    lower = AppConfig.sqlite? ? "hellotime_lower" : "LOWER"
    scope.where(
      "#{lower}(capsules.title) LIKE :pattern ESCAPE '\\' OR #{lower}(users.nickname) LIKE :pattern ESCAPE '\\'",
      pattern: pattern,
    )
  end

  def counts_by_opening(scope, now)
    predicate = Capsule.open_at_column.lteq(CrossDb.time_bound(now))
    groups = scope.group(predicate).count
    [groups.fetch(true, groups.fetch(1, 0)), groups.fetch(false, groups.fetch(0, 0))]
  end

  def favorite_set(viewer_id, capsule_ids)
    return Set.new if viewer_id.nil? || capsule_ids.empty?

    Favorite.where(user_id: viewer_id, capsule_id: capsule_ids).pluck(:capsule_id).to_set
  end

  def page_of(scope, page, page_size)
    scope.offset((page - 1) * page_size).limit(page_size)
  end

  def pagination(total, page, page_size)
    { page: page, pageSize: page_size, total: total, totalPages: total.fdiv(page_size).ceil }
  end
end
