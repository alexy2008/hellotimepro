# HelloTime Pro · Vapor 后端

Swift + Vapor 实现的 HelloTime Pro 后端，满足 `spec/` 定义的统一 API 契约，支持 PostgreSQL / SQLite 双驱动。
端口 **29060**（见根 `CLAUDE.md` 端口分配）。仅 macOS 本地开发（Swift 工具链）。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | Swift 6.2（Swift 5 语言模式） |
| 框架 | Vapor 4（SwiftNIO，async/await 全链路） |
| 序列化 | Foundation JSONEncoder/JSONDecoder + 手工 JSON 树 |
| 数据访问 | SQLKit（手写参数化 SQL）+ PostgresKit / SQLiteKit |
| 数据库 | PostgreSQL 16 / SQLite 3 双驱动 |
| 鉴权 | 手写 JWT HS256（swift-crypto HMAC）+ Vapor 内置 Bcrypt |
| 构建 | Swift Package Manager |

## 目录结构（分层）

```
server/Sources/App/
  entrypoint.swift        ← @main + configure（中间件/端口/HTTP 客户端超时）
  AppComponents.swift     ← 手动依赖装配（无 DI 容器）
  Config/AppConfig.swift  ← 环境变量驱动的配置
  Web/                    ← 路由注册 / ApiError 中间件 / Envelope / AuthContext（presentation）
  Services/               ← 业务服务 + 手写校验 + LLM 客户端（application/domain）
  Infra/                  ← AppDatabase（连接/事务/跨库编解码）+ 仓储（infrastructure）
  Domain/Models.swift     ← 领域模型
server/Tests/AppTests/    ← 纯函数层单元测试（无需数据库）
```

> Swift 包放在 `server/` 子目录而非 `backends/vapor` 根：SwiftPM **根包身份取自目录名**，
> `vapor` 目录会与依赖包 `vapor` 同身份，报 `cyclic dependency`。

## 安装与运行

需要 Xcode / Swift 6.2+ 工具链（`swift --version` 确认）。

```bash
# 通过仓库级 dev-manager（推荐，会注入 DB/LLM 配置）
./scripts/db reset --seed          # 显式准备数据库（后端不自己建表/迁移）
./scripts/hello start vapor
./scripts/hello logs vapor

# 或直接在本目录
./build        # release 编译 + 预热 SwiftPM 依赖缓存
./run          # 启动（默认 postgres；DB_DRIVER=sqlite 切 SQLite）
./test         # 单元测试（纯函数层，无需数据库）
```

> `run` 先做增量 `swift build -c release`（预热后 ~1s）再 `exec` 二进制：保持同进程组，
> `hello stop` 的 `killpg` 才能连同清掉。

## 切换数据库驱动

由环境变量控制，schema/数据生命周期完全在后端之外（`scripts/db`）：

```bash
DB_DRIVER=postgres ./run     # 默认；DB_URL 由 hello 从 data/.hello-state.json 注入
DB_DRIVER=sqlite   ./run     # DB_URL=sqlite:///<abs path>
```

`DB_URL` 支持 `postgresql://user:pass@host:port/db` 与 `sqlite:///<path>`，在 `Infra/Database.swift`
解析为 PostgresKit 连接池 / SQLite 单连接配置。后端 **不** 创建/重置 schema、不迁移、不 seed。

## 实现特色

- **跨库值编解码**（`Infra/Database.swift`）：业务 SQL 只写一份，UUID / 时间戳 / 布尔在绑定与读取时按驱动分流——
  SQLite 存 32 位无横线 hex TEXT、ISO-8601 TEXT（微秒 + `+00:00`，与 seed 完全一致，保证字符串比较的
  `open_at <= now` / `ORDER BY created_at` 正确）、0/1 整数；Postgres 用原生 `uuid` / `timestamptz` / `boolean` 直传。
- **SQLite 单连接 + FIFO 门闩**：actor 实现的异步互斥把全部 SQLite 访问串行化，
  配合 `BEGIN IMMEDIATE` 避免写竞争。
- **收藏计数并发安全**：幂等 UPSERT 和原子更新维护计数；PostgreSQL 的收藏、取消与删除统一先锁胶囊行。
- **refresh token 轮转 + 家族吊销**：重用检测分支先提交家族吊销再抛 401（事务内不抛异常、用 outcome 枚举区分）；
  Postgres 路径对 token 行加 `FOR UPDATE`。
- **显式 null 输出**：响应统一手工构造 `JSON` 枚举树——Swift 合成 Encodable 对 Optional 走 `encodeIfPresent`
  直接丢键，而契约用 strict equal 断言 `data`/`errorCode`/`content` 为显式 `null`。
- **手写 JWT HS256**：签发/校验各 ~20 行（swift-crypto HMAC + base64url），不引第三方 JWT 库；
  过期统一 `access_token_expired`、非法统一 `invalid_token`。
- **LLM 客户端**（`Services/LlmClient.swift`）：基于 Vapor `app.client`，实现日志规范 / 网关瞬时错误重试 /
  CF-1010 UA / chat 风格跳过 `/responses` 等坑的处理（见 `docs/dev-notes.md §3`）。
  未配置时建议端点本地兜底、推荐端点返回空列表。

## 注意事项

- `hello start` 不注入 `PORT`，默认端口直接是登记端口 29060。
- 运行环境用 `--env production` + `LOG_LEVEL=info`（LLM 日志规范要求 INFO 可见）。
- 详细代码导读见 [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)。

## 2.0 验证

2026-11-21，直接访问 Vapor 的 `:29060`，不经过共享反代。

| 检查 | 数据库 | 结果 |
|---|---|---|
| `./test -c release` | 涉及数据库的测试使用独立临时 SQLite 文件 | 16/16 |
| `./verification/scripts/verify-contract.sh vapor` | 独立 PostgreSQL 库 `hellotime_contract_vapor_*` | 117/117 |
| 同一契约脚本 | 独立临时 SQLite 文件 | 117/117 |

`./build` 通过。复跑契约时须显式传入 `DB_DRIVER` 和独立库的 `DB_URL`；不适用 UI 冒烟和设计令牌检查。

## 2.0 迁移笔记

- 无 schema 迁移。SQLKit 以 `SQLQueryString` 插入统计投影，保留时间参数绑定；列表与统计共用搜索谓词，两个开启时刻不受 `q` 影响。
- 继续使用 JSON 枚举树，空时间字段输出显式 `null`，不经 Codable 的 `encodeIfPresent`。
- SQLite 文件路径恰好移除 `sqlite:///`；继续沿用 actor 门闩和 `BEGIN IMMEDIATE`。回归测试关闭外键，验证删除在事务中先显式清理收藏。
