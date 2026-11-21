import Foundation

/// 广场列表 / 我创建的 / 我收藏的（分页查询）。
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
        let search = try searchTerm(q)
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

    private func searchTerm(_ raw: String?) throws -> String? {
        guard let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        if trimmed.unicodeScalars.count > 50 {
            throw ApiError.validation("q 长度不得超过 50", "q")
        }
        return trimmed.lowercased()
    }

    func plazaStats(q: String?) async throws -> JSON {
        let search = try searchTerm(q)
        let now = Date()
        return try await db.withSQL { sql in
            let counts = try await capsules.plazaCounts(sql, now: now, search: search)
            let farthest = try await capsules.farthestOpenAt(sql)
            let next = try await capsules.nextOpenAt(sql, now: now)
            return .object([
                "counts": .object(["all": .int(counts.all), "opened": .int(counts.opened), "unopened": .int(counts.unopened)]),
                "farthestOpenAt": farthest.map { .string(IsoDate.jsonString($0)) } ?? .null,
                "nextOpenAt": next.map { .string(IsoDate.jsonString($0)) } ?? .null,
            ])
        }
    }

    func myStats(_ user: User) async throws -> JSON {
        let now = Date()
        return try await db.withSQL { sql in
            let counts = try await capsules.ownedCounts(sql, ownerId: user.id, now: now)
            let given = try await capsules.countFavoritesByUser(sql, user.id)
            return .object([
                "created": .int(counts.states.all), "opened": .int(counts.states.opened),
                "unopened": .int(counts.states.unopened), "inPlaza": .int(counts.inPlaza),
                "favoritesReceived": .int(counts.favoritesReceived), "favoritesGiven": .int(given),
            ])
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
