# HelloTime Pro FastAPI 后端技术手册与代码导读

本文面向已经熟悉 Python 基本语法，但还不熟悉 Web 框架、FastAPI、SQLAlchemy 或后端分层设计的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入后端后，代码按什么顺序执行。
- FastAPI、Pydantic、SQLAlchemy、Alembic 参考迁移分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

## 1. 技术选型与设计特色

HelloTime Pro 的 FastAPI 后端实现基于 **Python + FastAPI + SQLAlchemy** 核心骨架，并选用 **Pydantic** 进行数据校验与 Schema 定义，保留 **Alembic** 迁移文件作为参考实现的 schema 落地样例，使用 **pytest** 驱动自动化测试，同时支持 **PostgreSQL** 和 **SQLite** 双数据库驱动切换。运行时数据库生命周期由仓库级 `scripts/db` 统一维护，后端只连接已经准备好的数据库。其具体选型考量与设计特色如下：

* **FastAPI（类型化 Web 框架与自动文档）**：本实现采用同步路由函数与同步 SQLAlchemy Session，突出 FastAPI 的依赖注入、Pydantic 边界校验和自动 OpenAPI 文档，而不是演示 async 数据访问。搭配 Uvicorn 运行，框架天然集成 Swagger UI，便于教学和调试。
* **Pydantic（严格的输入校验与类型契约）**：接口边界上的输入与输出数据完全通过 Pydantic Schema 进行结构化声明与校验。在请求到达业务逻辑前即完成严格的字段校验与类型转换，提供安全可靠的类型安全边界。
* **SQLAlchemy（灵活的双数据库引擎）**：采用 SQLAlchemy ORM 作为数据库访问层，并配置了跨驱动连接池与方言支持。使后端无需修改任何核心代码，即可通过环境变量一键在生产级 PostgreSQL 与轻量级 SQLite 之间进行无缝切换。
* **分层解耦的架构设计**：项目严格遵循**呈现层 -> 应用层 -> 领域层 -> 基础设施层**的经典四层架构。路由逻辑（Routers）、数据校验（Schemas）、业务逻辑（Services）与数据模型（Models）各司其职，保证了极佳的模块化与可维护性。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。FastAPI 后端的职责是：

- 提供 `/api/v1/*` HTTP API。
- 校验请求数据，例如邮箱格式、密码强度、胶囊开启时间。
- 处理用户注册、登录、JWT access token、refresh token 轮转。
- 读写用户、胶囊、收藏、refresh token 等数据。
- 保证返回格式符合 `spec/api/openapi.yaml`。

核心目录：

```text
backends/fastapi/
├── app/
│   ├── main.py              # FastAPI 应用入口
│   ├── deps.py              # Depends 依赖：数据库、当前用户
│   ├── api/v1/              # 路由层：定义 URL 和 HTTP 方法
│   ├── schemas/             # Pydantic DTO：请求/响应数据结构
│   ├── services/            # 业务层：注册、胶囊、收藏、广场等逻辑
│   ├── models/              # SQLAlchemy ORM 模型：数据库表的 Python 表达
│   ├── db/                  # 数据库 engine、session、跨驱动类型
│   └── core/                # 配置、错误、安全工具
├── alembic/                 # Alembic 迁移参考（run 不自动执行）
├── tests/                   # pytest 测试
├── run                      # 开发运行脚本
├── test                     # 测试脚本
└── build                    # 构建/依赖校验脚本
```

一个典型请求的流向：

```text
浏览器 / 前端
  ↓ HTTP
app/main.py
  ↓ include_router
app/api/v1/*.py
  ↓ Depends 注入 db / user
app/schemas/*.py 校验请求体
  ↓ 调用
app/services/*.py
  ↓ SQLAlchemy Session
app/models/*.py
  ↓
PostgreSQL 或 SQLite
```

## 3. 如何运行和验证

开发运行：

```bash
cd backends/fastapi
DB_DRIVER=sqlite ./run
```

默认端口是 `29010`。启动后可访问：

- 健康检查：`http://127.0.0.1:29010/api/v1/health`
- Swagger UI：`http://127.0.0.1:29010/docs`

测试：

```bash
cd backends/fastapi
./test
```

构建/依赖校验：

```bash
cd backends/fastapi
./build
```

`run` 脚本做了几件重要的事：

1. 用 `uv sync` 安装依赖。
2. 当 `DB_DRIVER=sqlite` 且未设置 `DB_URL` 时，自动使用 `data/sqlite/hellotime.db`。
3. 把普通 PostgreSQL URL 标准化为 SQLAlchemy 需要的 `postgresql+psycopg://`。
4. 用 `uvicorn app.main:app` 启动 FastAPI。

注意：`run` 不创建 schema、不执行 Alembic、不注入演示数据。数据库初始化、reset、seed 必须显式使用根目录 `scripts/db`。

## 4. 入口：`app/main.py`

`app/main.py` 是整个 Web 应用的入口。最重要的是 `create_app()`：

```python
app = FastAPI(
    title="HelloTime Pro · FastAPI",
    version=settings.service_version,
    docs_url="/docs",
    openapi_url="/openapi.json",
)
```

这行创建 FastAPI 应用对象。FastAPI 会基于路由和 Pydantic schema 自动生成 OpenAPI 文档，因此 `/docs` 可以直接看到接口调试页面。

入口文件做了四类工作：

- 同步静态资源：`_sync_static_assets()` 会从 `spec/avatars` 和 `spec/icons` 拷贝 SVG 到本后端的 `static/`。
- 注册 CORS：开发期允许前端跨域访问。
- 挂载路由：`app.include_router(api_router)` 把 `app/api/v1` 的所有接口接进来。
- 统一错误处理：把业务异常和请求校验异常转成统一响应格式。

这里有一个对初学者很关键的点：业务代码不直接返回错误 JSON。业务层只抛出 `APIError`，真正把异常变成 HTTP 响应的是 `main.py` 里的 exception handler。

例如业务层抛：

```python
raise errors.unauthorized("缺少 access token")
```

最后客户端会收到类似：

```json
{
  "success": false,
  "data": null,
  "message": "缺少 access token",
  "errorCode": "UNAUTHORIZED"
}
```

## 5. 路由层：`app/api/v1`

路由层负责把 HTTP 的世界翻译成 Python 函数调用。它不应该塞太多业务细节。

聚合入口是 `app/api/v1/__init__.py`：

```python
router = APIRouter(prefix="/api/v1")
router.include_router(health.router)
router.include_router(auth.router)
router.include_router(me.router)
router.include_router(capsules.router)
router.include_router(plaza.router)
router.include_router(favorites.router)
router.include_router(capsule_suggestion.router)
```

所以 `auth.py` 中的 `/auth/login`，最终完整路径是：

```text
/api/v1/auth/login
```

### 4.1 一个路由函数长什么样

以注册接口为例：

```python
@router.post("/register", response_model=Envelope[AuthTokens], status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> Envelope[AuthTokens]:
    tokens = auth_service.register(
        db,
        email=req.email,
        password=req.password,
        nickname=req.nickname,
        avatar_id=req.avatarId,
    )
    return Envelope(success=True, data=tokens)
```

这里同时出现了几个 FastAPI 关键概念：

- `@router.post("/register")`：声明这是一个 POST 接口。
- `req: RegisterRequest`：请求 body 会被解析成 Pydantic 模型，并自动校验。
- `db: Session = Depends(get_db)`：FastAPI 会调用 `get_db()`，把数据库 session 注入进来。
- `response_model=Envelope[AuthTokens]`：声明响应模型，FastAPI 会据此生成文档并序列化返回值。

路由层通常只做三件事：

1. 接收请求参数。
2. 调用 service。
3. 把 service 返回值包成 `Envelope`。

## 6. Schema 层：`app/schemas`

Schema 是接口边界上的数据结构，使用 Pydantic 定义。可以把它理解成“输入输出的类型说明 + 校验规则”。

例如注册请求：

```python
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    nickname: str = Field(min_length=2, max_length=20)
    avatarId: str = Field(min_length=2, max_length=20)
```

FastAPI 收到请求后，会先尝试把 JSON 转成 `RegisterRequest`。如果字段缺失、类型错误或不满足规则，路由函数根本不会执行，FastAPI 会抛出 `RequestValidationError`，再被 `main.py` 转成统一错误格式。

复杂一点的校验用 `@field_validator`：

```python
@field_validator("password")
@classmethod
def _password_policy(cls, v: str) -> str:
    if not _PASSWORD_RE.match(v):
        raise ValueError("密码至少 8 位且需包含字母和数字")
    return v
```

`schemas/common.py` 中的 `Envelope` 是统一响应壳：

```python
class Envelope(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str | None = None
    errorCode: str | None = None
```

成功响应通常长这样：

```json
{
  "success": true,
  "data": {
    "...": "..."
  },
  "message": null,
  "errorCode": null
}
```

## 7. 依赖注入：`app/deps.py`

FastAPI 的 `Depends()` 是初学者最容易陌生的部分。可以把它理解成：“在执行路由函数前，先帮我准备好某个对象”。

本项目主要有三类依赖：

- `get_db()`：准备数据库 session。
- `current_user_optional()`：如果有 token 就解析用户，没有也允许继续。
- `current_user_required()`：必须登录，否则抛 401。

例如创建胶囊接口：

```python
def create_capsule(
    req: CreateCapsuleRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_user_required),
) -> Envelope[CapsuleDetail]:
```

执行顺序可以理解为：

1. FastAPI 解析请求 body，得到 `CreateCapsuleRequest`。
2. 调用 `get_db()`，得到 `Session`。
3. 调用 `current_user_required()`，从 `Authorization` header 里解析 Bearer token。
4. 如果 token 有效，从数据库查出 `User`。
5. 把 `req`、`db`、`user` 传进 `create_capsule()`。

`current_user_required()` 的核心流程：

```text
Authorization: Bearer <access_token>
  ↓
_parse_bearer
  ↓
security.decode_access_token
  ↓
payload["sub"] 转 UUID
  ↓
select(User).where(User.id == user_id)
```

## 8. 数据库连接：`app/db`

本实现支持 PostgreSQL 和 SQLite。切换依赖环境变量：

```bash
DB_DRIVER=postgres
DB_URL=postgresql+psycopg://...
```

或：

```bash
DB_DRIVER=sqlite
DB_URL=sqlite:///...
```

`app/db/engine.py` 负责创建 SQLAlchemy engine：

```python
engine = create_engine(url, **kwargs)
```

SQLite 有一些额外设置：

- `check_same_thread=False`：允许 FastAPI 多线程场景使用。
- `PRAGMA foreign_keys=ON`：启用外键约束。
- `PRAGMA journal_mode=WAL`：提升并发写入表现。
- `PRAGMA synchronous=NORMAL`：在安全和性能之间折中。

`app/db/session.py` 创建 `SessionLocal`：

```python
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)
```

初学者先记住：业务代码里所有数据库查询、插入、提交，基本都通过 `Session` 完成。

```python
db.add(user)
db.flush()
db.commit()
```

常见方法：

- `db.add(obj)`：准备新增一行。
- `db.execute(select(...))`：执行查询。
- `db.flush()`：把当前改动发给数据库，但事务还没最终提交。
- `db.commit()`：提交事务。
- `db.rollback()`：回滚事务。
- `db.refresh(obj)`：从数据库重新加载对象的最新值。

## 9. ORM 模型：`app/models`

ORM 模型把数据库表映射成 Python 类。

例如 `User`：

```python
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100), nullable=False)
```

这表示：

- 表名是 `users`。
- `id` 是主键。
- `email` 是字符串，不能为空，唯一，并建立索引。
- `password_hash` 存密码哈希，不存明文密码。

本项目有四张主要表：

| 模型 | 表 | 作用 |
|---|---|---|
| `User` | `users` | 用户账号、昵称、头像 |
| `Capsule` | `capsules` | 时间胶囊标题、正文、开启时间、公开状态 |
| `Favorite` | `favorites` | 用户收藏胶囊的关联表 |
| `RefreshToken` | `refresh_tokens` | refresh token 哈希、家族 ID、吊销状态 |

注意：`models` 描述“数据库长什么样”，`schemas` 描述“API 输入输出长什么样”。二者不要混淆。

## 10. 迁移：`alembic`

ORM 模型是 Python 代码里的表结构描述。仓库当前约束是：真正的 schema 初始化、重建、seed 都由根目录 `scripts/db` 读取 `spec/db` 统一完成，`backends/fastapi/run` 不会隐式执行 Alembic。

因此这里的 Alembic 文件有两个用途：

- 作为参考实现阶段留下的 Python 迁移样例，展示 SQLAlchemy/Alembic 如何表达同一份 schema。
- 当你需要手动验证空库建表时，可以显式运行 `uv run alembic upgrade head`。如果目标库已经由 `scripts/db init/reset` 准备过，直接运行 Alembic 会因为表已存在而失败。

迁移文件在：

```text
alembic/versions/0001_initial.py
```

它创建了：

- `users`
- `capsules`
- `favorites`
- `refresh_tokens`
- 索引和检查约束

`alembic/env.py` 会读取 `settings.db_url`，复用 `build_engine()`，因此手动运行迁移时和应用运行时使用同一套数据库配置。

如果未来新增字段，一般步骤是：

1. 修改 `app/models/*.py`。
2. 修改 `app/schemas/*.py`，如果该字段出现在 API 中。
3. 先修改 `spec/db` 与仓库级维护脚本；如需保留 FastAPI 迁移样例，再新增 Alembic migration。
4. 补测试。

## 11. 业务层：`app/services`

Service 是本项目的业务核心。路由层尽量薄，真正的规则都放在 service。

### 10.1 鉴权：`auth_service.py`

负责：

- 注册：`register`
- 登录：`login`
- 刷新 token：`refresh`
- 登出：`logout`
- 修改密码：`change_password`

注册流程：

```text
register()
  ↓
检查 avatarId 是否存在
  ↓
邮箱转小写
  ↓
检查 email / nickname 是否重复
  ↓
hash_password
  ↓
插入 User
  ↓
_issue_token_pair
  ↓
commit
```

密码不会明文入库，而是通过 `bcrypt` 生成哈希：

```python
password_hash=security.hash_password(password)
```

refresh token 的设计也值得重点看：

- access token 是 JWT，客户端直接携带。
- refresh token 是随机字符串。
- 数据库里只存 refresh token 的 SHA-256 哈希，不存原文。
- 每次刷新都会生成新 refresh token，并把旧 token 标为 revoked。
- 如果已 revoked 的旧 token 被再次使用，认为可能发生重放攻击，于是整条 token family 都吊销。

这就是代码注释里说的 refresh token rotate 和 family tracking。

### 10.2 胶囊：`capsule_service.py`

负责：

- 创建胶囊：`create`
- 通过 code 查看胶囊：`get_by_code`
- 通过广场 id 查看胶囊：`get_plaza_detail`
- 删除自己的胶囊：`delete_own`

创建时会生成 8 位码：

```python
_CODE_ALPHABET = string.ascii_uppercase + string.digits
```

如果随机码撞上已有 code，会最多重试 5 次：

```python
for _ in range(5):
    code = _generate_code()
    ...
    try:
        db.flush()
        db.commit()
        ...
    except IntegrityError:
        db.rollback()
        continue
```

未开启的胶囊不会返回正文：

```python
content=c.content if (opened and include_content) else None
```

这里的重点是：后端不能依赖前端隐藏内容。只要未到开启时间，API 就直接不返回 `content`。

### 10.3 广场列表：`plaza_service.py`

负责：

- 公开胶囊列表：`plaza_list`
- 我创建的胶囊：`my_capsules`
- 我收藏的胶囊：`my_favorites`

广场列表支持：

- `sort=new`：按创建时间倒序。
- `sort=hot`：按收藏数倒序，再按创建时间倒序。
- `filter=all/opened/unopened`：全部、已开启、未开启。
- `q`：按标题或作者昵称搜索。
- `page/pageSize`：分页。

分页返回格式由 `Paginated` 和 `Pagination` 定义：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

### 10.4 收藏：`favorite_service.py`

收藏的难点不是插入一条 `favorites`，而是保证 `capsules.favorite_count` 始终正确。

添加收藏时：

1. 查胶囊，不存在或不公开则 404。
2. 不允许收藏自己的胶囊。
3. 如果已经收藏，直接返回当前状态，这是幂等行为。
4. 插入 `Favorite`。
5. 用 SQL 原子表达式把 `favorite_count + 1`。
6. 提交事务。

关键代码：

```python
db.execute(
    update(Capsule)
    .where(Capsule.id == capsule.id)
    .values(favorite_count=Capsule.favorite_count + 1)
)
```

这里没有先读出数字、在 Python 里 `+1`、再写回去，而是让数据库执行 `favorite_count = favorite_count + 1`。这样更适合并发场景。

PostgreSQL 下还会使用 `SELECT ... FOR UPDATE` 给胶囊行加锁：

```python
if lock and settings.db_driver == "postgres":
    stmt = stmt.with_for_update()
```

### 10.5 用户资料：`user_service.py`

负责：

- 把 `User` ORM 对象转成 `UserOut`。
- 更新昵称和头像。
- 检查昵称冲突。
- 检查头像 ID 是否在头像目录中。

### 10.6 头像与胶囊建议

`avatar_service.py` 从 `spec/avatars/catalog.json` 读取头像目录，并用 `lru_cache` 缓存。

`capsule_suggestion_service.py` 用于根据标题生成胶囊正文和建议开启时间：

- 如果配置了 LLM，会调用 `llm_client.py`。
- 如果未启用 LLM 或没有 key，会返回本地模板 fallback。
- 结果不缓存，便于前端“重新生成”按钮每次拿到新建议。

## 12. 安全工具：`app/core/security.py`

这个文件不关心 HTTP，只提供安全相关的底层函数：

- `hash_password()`：bcrypt 哈希密码。
- `verify_password()`：校验明文密码和哈希是否匹配。
- `create_access_token()`：生成 JWT access token。
- `decode_access_token()`：解析 JWT access token。
- `generate_refresh_token()`：生成随机 refresh token。
- `hash_refresh_token()`：把 refresh token 变成 SHA-256 哈希。

JWT payload 里包含：

```python
payload = {
    "sub": str(user_id),
    "nickname": nickname,
    "avatarId": avatar_id,
    "iat": now,
    "exp": exp,
}
```

`sub` 是 subject，通常表示当前 token 属于哪个用户。

## 13. 配置：`app/core/config.py`

配置使用 `pydantic-settings`：

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
```

这意味着配置可以来自：

- 默认值。
- 环境变量。
- `.env` 文件。

常用配置：

| 配置 | 作用 |
|---|---|
| `DB_DRIVER` | `postgres` 或 `sqlite` |
| `DB_URL` | 数据库连接字符串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `ACCESS_TOKEN_TTL_SECONDS` | access token 过期时间 |
| `REFRESH_TOKEN_TTL_SECONDS` | refresh token 过期时间 |
| `LLM_ENABLED` | 是否启用胶囊建议 LLM |
| `LLM_API_KEY` | LLM API key |

类属性使用 snake_case，例如 `db_driver`，环境变量通常写成大写，例如 `DB_DRIVER`。

## 14. 错误处理：`app/core/errors.py`

业务代码统一抛 `APIError`，不要在 service 里直接构造 FastAPI 的 `HTTPException`。

例如：

```python
raise errors.not_found("胶囊不存在")
```

`ErrorCode` 到 HTTP 状态码的映射集中在 `ERROR_TO_STATUS`：

| ErrorCode | HTTP |
|---|---|
| `VALIDATION_ERROR` | 422 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `RATE_LIMITED` | 429 |
| `BAD_REQUEST` | 400 |
| `INTERNAL_ERROR` | 500 |

好处是：业务层只表达“发生了什么业务错误”，入口层统一决定“怎么变成 API 响应”。

## 15. 测试：`tests`

测试默认使用 SQLite，不依赖外部 PostgreSQL。

`tests/conftest.py` 做了测试环境准备：

- 设置 `DB_DRIVER=sqlite`。
- 设置测试数据库路径 `_pytest.db`。
- `./test` 脚本会先对临时 SQLite 库显式执行 Alembic migration；应用运行脚本不会隐式迁移业务库。
- 每个测试前清空业务表。
- 提供 `client` fixture，用 FastAPI `TestClient` 发送请求。
- 提供 `db` fixture，用于直接测试 service。

`tests/test_smoke.py` 是黑盒风格的主流程测试：

```text
register → login → create capsule → plaza → favorite
```

`tests/test_auth_service.py` 更偏 service 单元测试，直接调用 `auth_service`，验证 refresh token 轮转、重放吊销、改密吊销等规则。

初学者读测试的建议：

1. 先看 `test_register_login_flow`，理解用户怎样从 HTTP 注册和登录。
2. 再看 `test_capsule_create_and_query`，理解未开启胶囊为什么没有 content。
3. 再看 `test_refresh_rotate_and_logout`，理解 refresh token 为什么不能重复使用。

## 16. 从一个真实请求读代码：注册

请求：

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "password123",
  "nickname": "alice",
  "avatarId": "neo"
}
```

代码路径：

```text
app/main.py
  include_router(api_router)
    ↓
app/api/v1/__init__.py
  include_router(auth.router)
    ↓
app/api/v1/auth.py
  register(req: RegisterRequest, db: Session)
    ↓
app/schemas/user.py
  RegisterRequest 自动校验
    ↓
app/deps.py
  get_db() 注入 Session
    ↓
app/services/auth_service.py
  register()
    ↓
app/core/security.py
  hash_password()
  create_access_token()
  generate_refresh_token()
  hash_refresh_token()
    ↓
app/models/user.py
app/models/refresh_token.py
  插入 users / refresh_tokens
    ↓
返回 Envelope[AuthTokens]
```

如果邮箱已存在，`auth_service.register()` 会抛：

```python
raise errors.conflict("邮箱已被注册", field="email")
```

然后 `main.py` 转成 409 JSON 响应。

## 17. 从一个真实请求读代码：创建胶囊

创建胶囊要求登录，所以会走 `current_user_required()`。

请求：

```http
POST /api/v1/capsules
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "title": "Hello Future",
  "content": "Secret note",
  "openAt": "2027-05-01T12:00:00Z",
  "inPlaza": true
}
```

代码路径：

```text
app/api/v1/capsules.py
  create_capsule()
    ↓
app/schemas/capsule.py
  CreateCapsuleRequest 校验 openAt
    ↓
app/deps.py
  current_user_required() 解析 token 并查 User
    ↓
app/services/capsule_service.py
  create()
    ↓
生成 8 位 code
    ↓
插入 Capsule
    ↓
_to_detail()
    ↓
返回 CapsuleDetail
```

`CreateCapsuleRequest` 对 `openAt` 有两个关键约束：

- 必须晚于当前时间 60 秒以上。
- 不得超过当前时间 10 年。

这类校验放在 schema 层，是因为它属于“请求格式和边界”的一部分。

## 18. 如何新增一个接口

假设要新增“检查当前用户 token 是否有效”的接口 `GET /api/v1/auth/session`，一般步骤如下。

第一步，在 `schemas/user.py` 添加响应 DTO，或复用已有 `UserOut`。

第二步，在 `api/v1/auth.py` 添加路由：

```python
@router.get("/session", response_model=Envelope[UserOut])
def session(user: User = Depends(current_user_required)) -> Envelope[UserOut]:
    return Envelope(success=True, data=user_service.to_out(user))
```

第三步，如果有业务逻辑，放到 `services/`，不要塞进路由函数。

第四步，补测试：

- 未带 token 返回 401。
- 带有效 token 返回当前用户。

第五步，确认契约。如果这是公开 API，需要同步更新 `spec/api/openapi.yaml`。

## 19. 如何新增一个数据库字段

假设要给胶囊新增 `mood` 字段：

1. 改 `app/models/capsule.py`，给 `Capsule` 增加列。
2. 改 `app/schemas/capsule.py`，决定创建和返回时是否包含 `mood`。
3. 改 `capsule_service.create()`，把请求字段写入模型。
4. 先修改 `spec/db` 与仓库级数据库维护脚本；如需保留 FastAPI 样例，再新增 Alembic migration。
5. 改测试，覆盖创建、查询、列表返回。
6. 如果属于 API 契约，更新 `spec/api/openapi.yaml`。

记住这条分工：

- `models`：数据库表。
- `schemas`：API 输入输出。
- `services`：业务规则。
- `api/v1`：HTTP 路由。
- `alembic`：参考迁移样例；运行时 schema 由 `scripts/db` 维护。
- `tests`：行为保证。

## 20. 初学者常见困惑

### 为什么有了 Pydantic schema，还要 SQLAlchemy model？

因为它们解决的是两个不同边界：

- Pydantic schema 面向 HTTP API。
- SQLAlchemy model 面向数据库。

API 可以隐藏字段，例如未开启胶囊不返回 `content`；数据库仍然必须保存完整正文。

### 为什么 service 里要手动 `commit()`？

因为数据库写入应该以事务为单位完成。比如收藏时，插入 `favorites` 和更新 `favorite_count` 必须一起成功或一起失败。

### 为什么 refresh token 数据库存哈希？

如果数据库泄漏，攻击者拿到哈希也不能直接当 refresh token 使用。这和密码不存明文是同一个思路。

### 为什么有些接口返回 204，不包 `Envelope`？

HTTP 204 的语义是 No Content，响应体应该为空。`main.py` 里还专门用 middleware 保证 204 没有 body。

### 为什么列表里要先 count 再查 rows？

分页响应需要 `total` 和 `totalPages`。因此要先统计符合条件的总数，再查询当前页的数据。

## 21. 推荐阅读顺序

第一次读代码建议按这个顺序：

1. `README.md`：先知道怎么跑。
2. `app/main.py`：理解应用怎么组装。
3. `app/api/v1/auth.py`：看一个最简单的路由模块。
4. `app/schemas/user.py`：理解请求体如何校验。
5. `app/deps.py`：理解 `Depends` 和当前用户。
6. `app/services/auth_service.py`：看完整注册/登录业务。
7. `app/models/user.py` 和 `app/models/refresh_token.py`：对照数据库表。
8. `tests/test_smoke.py`：从测试看实际 API 行为。
9. `app/services/capsule_service.py`、`plaza_service.py`、`favorite_service.py`：理解核心业务。
10. `alembic/versions/0001_initial.py`：理解数据库 schema 如何落地。

读完后，可以尝试做一个小练习：给 `/api/v1/health` 增加一个只读字段，例如当前数据库驱动名。这个练习会让你同时接触 schema、service 或路由、测试和返回 JSON。
