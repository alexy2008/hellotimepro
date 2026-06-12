# HelloTime Pro · Drogon 后端

C++20 + Drogon 实现的 HelloTime Pro 后端，满足 `spec/` 定义的统一 API 契约，支持 PostgreSQL / SQLite 双驱动。
端口 **29080**（见根 `CLAUDE.md` 端口分配）。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | C++20（协程全链路异步） |
| 框架 | Drogon 1.9.12（FetchContent 静态链接，Trantor 事件循环） |
| 序列化 | jsoncpp（Json::Value 显式 null） |
| 数据访问 | Drogon ORM（手写参数化 SQL，文本协议） |
| 数据库 | PostgreSQL 16（libpq）/ SQLite 3 双驱动 |
| 鉴权 | 手写 JWT HS256（OpenSSL HMAC）+ OpenBSD bcrypt |
| 构建 | CMake + Ninja |

## 目录结构（分层）

```
src/
  main.cc                  ← 入口：日志/CORS/自定义 404/路由/监听
  config.h/.cc             ← 环境变量驱动的配置
  app_state.h              ← AppState 手动装配（无 DI 容器）
  routes.h/.cc             ← 路由注册 + guarded 异常包装（presentation）
  services.h/.cc           ← auth/user/capsule/plaza/favorite + 鉴权上下文
  llm_client / suggestion_service / recommendation_service  ← LLM 集成
  validation / mapper / security / avatar_service / rate_limiter
  db.h/.cc                 ← Db（连接/事务/awaitCommit/文本化编解码）
  repos.h/.cc              ← 仓储（infrastructure）
  iso_date / json_util / api_error / domain
tests/unit_tests.cc        ← 纯函数层单元测试（35 项，无需数据库）
third_party/openbsd_bcrypt ← bcrypt（自本仓库 nest 后端 node_modules/bcrypt 复制）
```

## 安装与运行

需要 CMake ≥3.25、Ninja、Xcode 命令行工具；Homebrew 安装 `openssl@3`、`libpq`、`jsoncpp`。
Drogon 本体经 FetchContent 拉取并静态链接（首次构建需联网，约 4-5 分钟）。

```bash
# 通过仓库级 dev-manager（推荐，会注入 DB/LLM 配置）
./scripts/db reset --seed          # 显式准备数据库（后端不自己建表/迁移）
./scripts/hello start drogon
./scripts/hello logs drogon

# 或直接在本目录
./build        # 配置 + 全量编译（构建目录 build-out/）
./run          # 启动（默认 postgres；DB_DRIVER=sqlite 切 SQLite）
./test         # 单元测试（纯函数层，无需数据库）
```

> `run` 先做增量构建（预热后秒级）再 `exec` 二进制：保持同进程组，
> `hello stop` 的 `killpg` 才能连同清掉。构建目录叫 `build-out/`——`build` 这个名字
> 被构建脚本占用（同 ktor 的取舍）。

## 切换数据库驱动

由环境变量控制，schema/数据生命周期完全在后端之外（`scripts/db`）：

```bash
DB_DRIVER=postgres ./run     # 默认；DB_URL 由 hello 从 data/.hello-state.json 注入
DB_DRIVER=sqlite   ./run     # DB_URL=sqlite:///<abs path>
```

`DB_URL` 支持 `postgresql://user:pass@host:port/db` 与 `sqlite:///<path>`，在 `src/db.cc`
解析为 libpq 连接串 / SQLite 文件路径。后端 **不** 创建/重置 schema、不迁移、不 seed。

## 实现特色

- **文本化跨库编解码**（`src/db.cc`）：SQL 只写一份（`?` 占位统一转 `$1..$n`——PG 原生，
  SQLite 的 `$1` 恰好是合法命名参数）；**绑定参数全部文本化**——PG 走 libpq 文本协议由列
  上下文推断类型（uuid/timestamptz/boolean 都接受 ISO 文本），SQLite 靠列亲和性收编
  `'0'/'1'`。读取同样文本化后由 `row_get` 按格式还原（能读回 PG `+00` 短偏移时间戳）。
- **显式等待事务提交**（`Db::awaitCommit`）：drogon `Transaction` 析构是**异步**发 COMMIT，
  若不等待，响应可能先于提交发出，PG 连接池（8 连接）下一请求读不到刚写的数据——
  这是双驱动 104 用例从"偶发挂"到"稳定绿"的关键一步。
- **SQLite 连接数 1**：天然串行（对应 Axum 的池上限 1 / Vapor 的 FIFO 门闩）。
- **收藏计数并发安全**：幂等 UPSERT（`ON CONFLICT DO NOTHING RETURNING`）判定是否真插入 +
  原子 `favorite_count = favorite_count + 1`。
- **refresh token 轮转 + 家族吊销**：outcome 枚举 + `awaitCommit` 后再转 401
  （吊销必须先提交）；Postgres 路径对 token 行加 `FOR UPDATE`。
- **OpenBSD bcrypt**：源码复制自本仓库 nest 后端的 `node_modules/bcrypt`（ISC/BSD 许可，
  Provos 原版），`$2b$` 签发、`$2a$/$2b$` 互验——单元测试含与 Python seed 向量的互验。
- **手写 JWT HS256**：OpenSSL HMAC + 手写 base64url，签发/校验各 ~30 行；
  过期统一 `access_token_expired`、非法统一 `invalid_token`。
- **C++ 协程注意事项**：catch 块里不能 `co_await`（语言限制）——LLM 重试/回落、
  事务提交等"失败后异步补救"一律改为"catch 记 flag，try 外 co_await"。
- **LLM 客户端**（`src/llm_client.cc`）：基于 drogon HttpClient，实现日志规范 /
  网关瞬时错误重试 / CF-1010 UA / chat 风格跳过 `/responses` 等坑的处理
  （见 `docs/dev-notes.md §3`）。未配置时建议端点本地兜底、推荐端点返回空列表。

## 验证

```bash
./verification/scripts/verify-contract.sh drogon                   # PostgreSQL，104/104
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh drogon  # SQLite，104/104
```

## 注意事项

- `hello start` 不注入 `PORT`，默认端口直接是登记端口 29080。
- Homebrew 的 libpq 是 keg-only，CMakeLists 已显式追加 `/opt/homebrew/opt/libpq` 搜索路径。
- std::regex 不支持 lookahead / `\p{L}`：密码改字符扫描；昵称改 UTF-8 码点扫描
  （ASCII 严格、非 ASCII 放行，比 Unicode 属性表略宽）。
- 详细代码导读见 [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)。
