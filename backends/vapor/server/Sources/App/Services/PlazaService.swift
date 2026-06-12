import Foundation

/// 广场列表 / 我创建的 / 我收藏的（分页查询）。对应 Ktor 的 PlazaService。
struct PlazaService: Sendable {
    let db: AppDatabase
    let capsules: CapsuleRepository
    let mapper: MapperService

    func plazaList(
        sort: String, filter: String, q: String?,
        page: Int, pageSize: Int, viewerId: UUID?
    ) async throws -> JSON {
        try Validation.page(page, pageSize)
        let plazaSort: PlazaSort
        switch sort {
        case "hot": plazaSort = .hot
        case "new": plazaSort = .new
        default: throw ApiError.validation("sort 仅支持 hot/new", "sort")
        }
        let plazaFilter: PlazaFilter
        switch filter {
        case "all": plazaFilter = .all
        case "opened": plazaFilter = .opened
        case "unopened": plazaFilter = .unopened
        default: throw ApiError.validation("filter 仅支持 all/opened/unopened", "filter")
        }
        // q：trim 后为空视为未传；超 50 → 422；大小写不敏感子串匹配。
        var search = q?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if search?.isEmpty == true { search = nil }
        if let s = search, s.count > 50 {
            throw ApiError.validation("q 长度不得超过 50", "q")
        }
        let now = Date()

        return try await db.withSQL { sql in
            let total = try await capsules.countPlaza(sql, filter: plazaFilter, now: now, search: search)
            let rows = try await capsules.findPlazaPage(
                sql, filter: plazaFilter, now: now, search: search, sort: plazaSort,
                viewerId: viewerId, limit: pageSize, offset: (page - 1) * pageSize
            )
            return mapper.paginated(
                items: rows.map { mapper.listItem($0, now: now) },
                total: total, page: page, pageSize: pageSize
            )
        }
    }

    func myCapsules(_ user: User, page: Int, pageSize: Int) async throws -> JSON {
        try Validation.page(page, pageSize)
        let now = Date()
        return try await db.withSQL { sql in
            let total = try await capsules.countByOwner(sql, user.id)
            let rows = try await capsules.findByOwnerPage(
                sql, user.id, limit: pageSize, offset: (page - 1) * pageSize
            )
            return mapper.paginated(
                items: rows.map { mapper.listItem($0, now: now) },
                total: total, page: page, pageSize: pageSize
            )
        }
    }

    func myFavorites(_ user: User, page: Int, pageSize: Int) async throws -> JSON {
        try Validation.page(page, pageSize)
        let now = Date()
        return try await db.withSQL { sql in
            let total = try await capsules.countFavoritesByUser(sql, user.id)
            let rows = try await capsules.findFavoritesPage(
                sql, user.id, limit: pageSize, offset: (page - 1) * pageSize
            )
            return mapper.paginated(
                items: rows.map { mapper.listItem($0, now: now) },
                total: total, page: page, pageSize: pageSize
            )
        }
    }
}
