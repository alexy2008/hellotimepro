import Foundation

/// 从 spec/avatars/catalog.json 加载内置头像目录（启动时一次）。
struct AvatarService: Sendable {
    private struct CatalogAvatar: Decodable {
        let id: String
        let name: String
        let primaryColor: String
        let svgUrl: String?
    }

    private struct Catalog: Decodable {
        let avatars: [CatalogAvatar]
    }

    private let avatars: [(id: String, name: String, primaryColor: String, svgUrl: String?)]
    private let ids: Set<String>

    init(config: AppConfig) throws {
        let path = config.absRepoRoot + "/spec/avatars/catalog.json"
        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        let catalog = try JSONDecoder().decode(Catalog.self, from: data)
        self.avatars = catalog.avatars.map { ($0.id, $0.name, $0.primaryColor, $0.svgUrl) }
        self.ids = Set(catalog.avatars.map(\.id))
    }

    func list() -> JSON {
        .array(avatars.map {
            .object([
                "id": .string($0.id),
                "name": .string($0.name),
                "primaryColor": .string($0.primaryColor),
                "svgUrl": .from($0.svgUrl),
            ])
        })
    }

    func exists(_ id: String) -> Bool { ids.contains(id) }
}
