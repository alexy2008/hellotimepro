module PlazaService
  module_function

  def plaza_list(sort:, filter:, q:, page:, page_size:, viewer_id:)
    Validation.page!(page, page_size)
    raise ApiError.validation("sort 仅支持 hot/new", "sort") unless %w[hot new].include?(sort)
    raise ApiError.validation("filter 仅支持 all/opened/unopened", "filter") unless %w[all opened unopened].include?(filter)

    normalized = q&.strip&.downcase
    normalized = nil if normalized && normalized.empty?
    raise ApiError.validation("q 长度不得超过 50", "q") if normalized && normalized.length > 50

    now = Time.now.utc
    rel = Capsule.where(in_plaza: true)
    case filter
    when "opened" then rel = rel.where("open_at <= ?", db_time(now))
    when "unopened" then rel = rel.where("open_at > ?", db_time(now))
    end
    if normalized
      pattern = "%#{normalized}%"
      rel = rel.where(
        "LOWER(title) LIKE :q OR owner_id IN (SELECT id FROM users WHERE LOWER(nickname) LIKE :q)",
        q: pattern,
      )
    end

    total = rel.count
    ordered = sort == "hot" ? rel.order(favorite_count: :desc, created_at: :desc) : rel.order(created_at: :desc)
    rows = ordered.offset(offset(page, page_size)).limit(page_size).to_a

    owners = User.where(id: rows.map(&:owner_id)).index_by(&:id)
    faved = favorite_set(viewer_id, rows.map(&:id))
    items = rows.filter_map do |c|
      owner = owners[c.owner_id]
      next unless owner # 孤儿胶囊防御：owner 已删除则跳过（等价 INNER JOIN）

      MapperService.list_item(c, owner, favorited_by_me: faved.include?(c.id), favorited_at: nil)
    end
    { items: items, pagination: pagination(total, page, page_size) }
  end

  def my_capsules(user, page, page_size)
    Validation.page!(page, page_size)
    total = Capsule.where(owner_id: user.id).count
    rows = Capsule.where(owner_id: user.id).order(created_at: :desc)
                  .offset(offset(page, page_size)).limit(page_size).to_a
    items = rows.map { |c| MapperService.list_item(c, user, favorited_by_me: false, favorited_at: nil) }
    { items: items, pagination: pagination(total, page, page_size) }
  end

  def my_favorites(user, page, page_size)
    Validation.page!(page, page_size)
    total = Favorite.where(user_id: user.id).count
    favs = Favorite.where(user_id: user.id).order(created_at: :desc)
                   .offset(offset(page, page_size)).limit(page_size).to_a
    return { items: [], pagination: pagination(total, page, page_size) } if favs.empty?

    capsule_map = Capsule.where(id: favs.map(&:capsule_id)).index_by(&:id)
    owners = User.where(id: capsule_map.values.map(&:owner_id)).index_by(&:id)
    items = favs.filter_map do |f|
      c = capsule_map[f.capsule_id]
      next unless c

      owner = owners[c.owner_id]
      next unless owner

      MapperService.list_item(c, owner, favorited_by_me: true, favorited_at: f.created_at)
    end
    { items: items, pagination: pagination(total, page, page_size) }
  end

  def favorite_set(viewer_id, capsule_ids)
    return Set.new if viewer_id.nil? || capsule_ids.empty?

    Favorite.where(user_id: viewer_id, capsule_id: capsule_ids).pluck(:capsule_id).to_set
  end

  def offset(page, page_size)
    (page - 1) * page_size
  end

  def pagination(total, page, page_size)
    total_pages = page_size.zero? ? 0 : (total.to_f / page_size).ceil
    { page: page, pageSize: page_size, total: total, totalPages: total_pages }
  end

  def db_time(t)
    AppConfig.sqlite? ? CrossDb.format_timestamp(t) : t
  end
end
