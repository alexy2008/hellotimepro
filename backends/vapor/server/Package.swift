// swift-tools-version:5.9
// 注意：Swift 包放在 server/ 子目录而不是 backends/vapor 根：SwiftPM 根包身份取自
// 目录名，backends/vapor 会与依赖包 vapor 同身份（cyclic dependency 报错）。
import PackageDescription

let package = Package(
    name: "hellotime-vapor",
    platforms: [
        .macOS(.v13),
    ],
    dependencies: [
        .package(url: "https://github.com/vapor/vapor.git", from: "4.92.0"),
        .package(url: "https://github.com/vapor/sql-kit.git", from: "3.28.0"),
        .package(url: "https://github.com/vapor/postgres-kit.git", from: "2.13.0"),
        .package(url: "https://github.com/vapor/sqlite-kit.git", from: "4.5.0"),
    ],
    targets: [
        .executableTarget(
            name: "App",
            dependencies: [
                .product(name: "Vapor", package: "vapor"),
                .product(name: "SQLKit", package: "sql-kit"),
                .product(name: "PostgresKit", package: "postgres-kit"),
                .product(name: "SQLiteKit", package: "sqlite-kit"),
            ],
            path: "Sources/App"
        ),
        .testTarget(
            name: "AppTests",
            dependencies: [
                .target(name: "App"),
            ],
            path: "Tests/AppTests"
        ),
    ]
)
