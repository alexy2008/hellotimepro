import Foundation

/// 领域模型 → 响应 JSON。时间统一序列化为 ISO-8601 UTC（`...Z`），
/// id 输出小写带横线 UUID（契约正则 `^[0-9a-f-]{32,36}$`）。
struct MapperService: Sendable {
    func user(_ u: User) -> JSON {
        .object([
            "id": .string(u.id.uuidString.lowercased()),
            "email": .string(u.email),
            "nickname": .string(u.nickname),
            "avatarId": .string(u.avatarId),
            "createdAt": .string(IsoDate.jsonString(u.createdAt)),
        ])
    }

    /// 详情：未开启 content=null（作者也无特权预览）。
    func detail(_ view: CapsuleView, favoritedByMe: Bool, now: Date = Date()) -> JSON {
        let c = view.capsule
        let opened = c.openAt <= now
        var obj = base(view, opened: opened)
        obj["content"] = opened ? .string(c.content) : .null
        obj["favoritedByMe"] = .bool(favoritedByMe)
        return .object(obj)
    }

    /// 列表项：不含 content；已开启时给前 80 字符的 contentPreview。
    func listItem(_ view: CapsuleView, now: Date = Date()) -> JSON {
        let c = view.capsule
        let opened = c.openAt <= now
        var obj = base(view, opened: opened)
        obj["favoritedByMe"] = .bool(view.favoritedByMe)
        obj["favoritedAt"] = .from(view.favoritedAt.map { IsoDate.jsonString($0) })
        if opened {
            let trimmed = c.content.trimmingCharacters(in: .whitespacesAndNewlines)
            let preview = trimmed.count > 80 ? String(trimmed.prefix(80)) + "…" : trimmed
            obj["contentPreview"] = .string(preview)
        } else {
            obj["contentPreview"] = .null
        }
        return .object(obj)
    }

    func pagination(total: Int, page: Int, pageSize: Int) -> JSON {
        let totalPages = pageSize == 0 ? 0 : Int((Double(total) / Double(pageSize)).rounded(.up))
        return .object([
            "page": .int(page),
            "pageSize": .int(pageSize),
            "total": .int(total),
            "totalPages": .int(totalPages),
        ])
    }

    func paginated(items: [JSON], total: Int, page: Int, pageSize: Int) -> JSON {
        .object([
            "items": .array(items),
            "pagination": pagination(total: total, page: page, pageSize: pageSize),
        ])
    }

    private func base(_ view: CapsuleView, opened: Bool) -> [String: JSON] {
        let c = view.capsule
        return [
            "id": .string(c.id.uuidString.lowercased()),
            "code": .string(c.code),
            "title": .string(c.title),
            "creator": .object([
                "nickname": .string(view.ownerNickname),
                "avatarId": .string(view.ownerAvatarId),
            ]),
            "openAt": .string(IsoDate.jsonString(c.openAt)),
            "createdAt": .string(IsoDate.jsonString(c.createdAt)),
            "inPlaza": .bool(c.inPlaza),
            "favoriteCount": .int(c.favoriteCount),
            "isOpened": .bool(opened),
        ]
    }
}
