# 契约测试套件

黑盒契约测试，断言目标后端行为符合 [spec/api/openapi.yaml](../../spec/api/openapi.yaml)。

## 运行

```bash
# 默认打 fastapi 参考后端的直连端口
node --test verification/contract

# 或指向别的后端 / 反向代理
BASE_URL=http://127.0.0.1:9080 node --test verification/contract
```

脚本入口：[`verification/scripts/verify-contract.sh`](../scripts/verify-contract.sh) 会自动启停目标服务 + 重置 DB + 运行本目录。

## 设计原则

- **纯黑盒**：只用 HTTP + envelope。不读数据库、不 import 任何实现代码。
- **零 npm 依赖**：Node 原生 `node:test` + `fetch`，Node ≥ 22 直接跑 `.spec.ts`（类型剥离）。
- **自隔离**：每个 test 通过 `_helpers.ts::register()` 创建唯一用户 / 胶囊，不依赖前序状态，也不依赖运行顺序。
- **对齐 openapi**：本目录断言的是 spec，不是某个实现的实现细节。

## Spec 文件

| 文件 | 覆盖 |
|---|---|
| `health.spec.ts` | `GET /health` — envelope + stack items |
| `avatars.spec.ts` | `GET /avatars` — ≥10 项、字段齐全 |
| `auth.spec.ts` | register / login / refresh / logout + rotate |
| `auth-errors.spec.ts` | 401 / 403 / 429 错误路径 |
| `me.spec.ts` | `GET/PATCH /me`、`POST /me/password` + refresh 吊销 |
| `capsules-create.spec.ts` | 创建校验 + `GET /capsules/{code}` |
| `capsules-sealed.spec.ts` | 未开启胶囊：content=null、isOpened=false、inPlaza 过滤 |
| `capsules-opened.spec.ts` | isOpened 字段形态 + 删除语义（永远允许、非作者 403） |
| `plaza.spec.ts` | sort / filter / q / pagination |
| `favorites.spec.ts` | 幂等收藏 / 取消 / 我收藏的列表 |
| `favorites-count.spec.ts` | favorite_count 与实际行数一致 |
| `me-capsules.spec.ts` | 我创建的列表 + 删除级联 |
| `envelope.spec.ts` | 统一响应壳 + 204 无 body |
| `error-codes.spec.ts` | errorCode ↔ HTTP 严格映射 |

## 共享工具

[`_helpers.ts`](_helpers.ts) 提供：
- `api(method, path, {token, json, headers})` — fetch 封装，解析 envelope
- `register(overrides?)` — 注册并返回 `{accessToken, refreshToken, user…}`
- `createCapsule(token, overrides?)` — 登录后创建胶囊
- `isoFuture(sec)` / `uniqueEmail()` / `uniqueNickname()` — 时间与随机辅助

## 注意事项

- 每次运行前 DB 应被清空（由 `verify-contract.sh` 负责）；单条 spec 内部无清理假设。
- 登录限流（10/min per email）通过使用每测试独立邮箱绕开。
- "已开启胶囊"无法在黑盒内构造（创建时 openAt 必须 > now+60s），这部分留给手工 / UI smoke 验证。
