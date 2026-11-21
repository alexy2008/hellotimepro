# HelloTime Pro · Axum 后端

Rust + Axum 实现的 HelloTime Pro 后端，满足 `spec/` 定义的统一 API 契约，支持 PostgreSQL / SQLite 双驱动。
端口 **29070**（见根 `CLAUDE.md` 端口分配）。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | Rust 1.94（edition 2021） |
| 框架 | Axum 0.8（Tokio 异步运行时，async/await 全链路） |
| 序列化 | serde / serde_json（Value 树天然显式 null） |
| 数据访问 | sqlx 0.8（手写参数化 SQL，不用宏检查/ORM） |
| 数据库 | PostgreSQL 16 / SQLite 3 双驱动 |
| 鉴权 | 手写 JWT HS256（hmac + sha2）+ bcrypt crate |
| 构建 | Cargo |

## 目录结构（分层）

```
src/
  main.rs              ← 入口：日志/配置/路由/监听
  config.rs            ← 环境变量驱动的配置
  state.rs             ← AppState 手动装配（无 DI 容器）+ 登录限流器
  web/                 ← 路由注册 / ApiError(IntoResponse) / Envelope / Bearer 解析（presentation）
  services/            ← 业务服务 + 手写校验 + LLM 客户端（application/domain）
  infra/               ← Db（连接/事务/跨库编解码）+ 仓储 + IsoDate（infrastructure）
  domain.rs            ← 领域模型
```

> 与 Vapor 的 `server/` 子目录不同，Cargo 包名取自 `Cargo.toml` 的 `name`
> （`hellotime-axum`），目录叫 `axum` 不会和依赖 crate `axum` 撞身份。

## 安装与运行

需要 Rust 工具链（`cargo --version` 确认；rustup 或 Homebrew 安装均可）。

```bash
# 通过仓库级 dev-manager（推荐，会注入 DB/LLM 配置）
./scripts/db reset --seed          # 显式准备数据库（后端不自己建表/迁移）
./scripts/hello start axum
./scripts/hello logs axum

# 或直接在本目录
./build        # release 编译 + 预热 cargo 依赖缓存（首次约 4-5 分钟）
./run          # 启动（默认 postgres；DB_DRIVER=sqlite 切 SQLite）
./test         # 单元测试（纯函数层，无需数据库）
```

> `run` 先做增量 `cargo build --release`（预热后秒级）再 `exec` 二进制：保持同进程组，
> `hello stop` 的 `killpg` 才能连同清掉。

## 切换数据库驱动

由环境变量控制，schema/数据生命周期完全在后端之外（`scripts/db`）：

```bash
DB_DRIVER=postgres ./run     # 默认；DB_URL 由 hello 从 data/.hello-state.json 注入
DB_DRIVER=sqlite   ./run     # DB_URL=sqlite:///<abs path>
```

`DB_URL` 支持 `postgresql://user:pass@host:port/db` 与 `sqlite:///<path>`，在 `infra/db.rs`
解析为 sqlx 的 PgPool / SqlitePool 配置。后端 **不** 创建/重置 schema、不迁移、不 seed。

## 实现特色

- **跨库值编解码**（`infra/db.rs`）：业务 SQL 只写一份（`?` 占位，PG 端自动转 `$n`），
  绑定走 `Value` 枚举、读取走 `Cell` 枚举——SQLite 存 32 位无横线 hex TEXT、ISO-8601 TEXT
  （微秒 + `+00:00`，与 seed 完全一致，保证字符串比较的 `open_at <= now` / `ORDER BY created_at`
  正确）、0/1 整数；Postgres 用原生 `uuid` / `timestamptz` / `boolean` 直传。
- **SQLite 池上限 1**：sqlx 连接池 `max_connections(1)` 把全部 SQLite 访问串行化
  （对应 Vapor 的 actor 门闩 / Ktor 的"池=1"），配合 `BEGIN IMMEDIATE` 避免写竞争。
- **收藏计数并发安全**：幂等 UPSERT 和原子更新维护计数；PostgreSQL 的收藏、取消与删除统一先锁胶囊行。
- **refresh token 轮转 + 家族吊销**：重用检测分支先提交家族吊销再抛 401（事务内不抛异常、
  用 outcome 枚举区分，`conn.finish(result)` COMMIT 后再转错误）；Postgres 路径对 token 行加 `FOR UPDATE`。
- **显式 null 输出**：响应统一构造 `serde_json::Value` 树——`Value::Null` 序列化为显式
  `null`，天然满足契约对 `data`/`errorCode`/`content` 的 strict equal 断言（无需像 Swift
  那样对抗 `encodeIfPresent` 丢键）。
- **手写 JWT HS256**：签发/校验各 ~20 行（hmac + sha2 + base64url），不引第三方 JWT 库；
  过期统一 `access_token_expired`、非法统一 `invalid_token`。
- **错误即响应**：`ApiError` 实现 `IntoResponse`，handler 里 `?` 一路上抛即可输出契约错误外壳；
  请求体坏 JSON 通过 `Result<Json<T>, JsonRejection>` 显式接住转 422。
- **LLM 客户端**（`services/llm.rs`）：基于 reqwest，实现日志规范 / 网关瞬时错误重试 /
  CF-1010 UA / chat 风格跳过 `/responses` 等坑的处理（见 `docs/dev-notes.md §3`）。
  未配置时建议端点本地兜底、推荐端点返回空列表。

## 注意事项

- `hello start` 不注入 `PORT`，默认端口直接是登记端口 29070。
- Rust regex crate 不支持 lookahead，密码"含字母 + 含数字"改为显式字符扫描（语义等价）。
- 详细代码导读见 [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)。

## 2.0 验证

2026-11-21，直接访问 Axum 的 `:29070`，不经过共享反代。

| 检查 | 数据库 | 结果 |
|---|---|---|
| `./test` | 涉及数据库的测试使用内存 SQLite | 28/28 |
| `./verification/scripts/verify-contract.sh axum` | 独立 PostgreSQL 库 `hellotime_contract_axum_*` | 117/117 |
| 同一契约脚本 | 独立临时 SQLite 文件 | 117/117 |

`./build` 通过。复跑契约时须显式传入 `DB_DRIVER` 和独立库的 `DB_URL`；不适用 UI 冒烟和设计令牌检查。

## 2.0 迁移笔记

- 无 schema 迁移。sqlx 继续统一绑定两库时间与 UUID；SQLite URL 恰好移除 `sqlite:///`，避免绝对路径出现双前导斜杠。
- 广场列表、计数和统计共用字面搜索谓词；最远与最近开启时间从公开胶囊的时间列直接取值，无记录返回显式 `null`。
- 收藏、取消收藏、删除的 PostgreSQL 行锁只查询胶囊的 `owner_id`，不连表，避免锁住无关的作者行；SQLite 使用单连接和 `BEGIN IMMEDIATE`，删除顺序由禁用外键的回归测试覆盖。
