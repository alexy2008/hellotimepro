# 契约测试套件

M0 阶段只列用例清单 + 基础脚手架，真正的断言在 M1 随 FastAPI 参考栈一起落地。

## 组织

每个 `*.spec.ts` 文件对应一组关联端点，用 Node 原生 `fetch` + 断言库（`node:test` + `node:assert`）写成，避免引入额外 npm 依赖。

测试目标由环境变量 `BASE_URL` 决定（例如 `http://127.0.0.1:29010` 或 `http://127.0.0.1:9080`），以便同一套用例跑遍所有后端 / 全栈。

```bash
BASE_URL=http://127.0.0.1:29010 node --test verification/contract
```

## 已列出的 Spec 文件

| 文件 | 覆盖端点 | 断言重点 |
|---|---|---|
| `health.spec.ts` | `GET /health`, `GET /stack` | 返回栈标识 / 必填字段齐全 |
| `auth.spec.ts` | `POST /auth/register`, `/login`, `/refresh`, `/logout` | JWT 格式、refresh 轮转、重复注册冲突 |
| `auth-errors.spec.ts` | 错误场景 | 401 无效 token、429 限流、422 密码过短 |
| `avatars.spec.ts` | `GET /avatars` | 至少返回 10 个且字段齐全 |
| `me.spec.ts` | `GET /me`, `PATCH /me`, `POST /me/password` | 昵称修改、密码变更后 refresh 失效 |
| `capsules-create.spec.ts` | `POST /capsules`, `GET /c/{code}` | 创建、code 格式 `[A-Z0-9]{8}`、60 秒约束 |
| `capsules-sealed.spec.ts` | 未开启胶囊 | 广场不可见、详情隐藏内容、倒计时字段 |
| `capsules-opened.spec.ts` | 已开启胶囊 | 广场可见、内容公开、favoriteCount 一致 |
| `plaza.spec.ts` | `GET /plaza`, `?sort=hot|new` | 分页、排序稳定性、inPlaza 过滤 |
| `favorites.spec.ts` | `POST/DELETE/GET /capsules/{id}/favorite` | 幂等、重复收藏返 200、取消未收藏返 204 |
| `favorites-count.spec.ts` | 计数同步 | 并发收藏/取消后 favorite_count 与实际行数一致 |
| `me-capsules.spec.ts` | `GET /me/capsules`, `DELETE /me/capsules/{id}` | 仅作者可撤回、已开启不可删 |
| `envelope.spec.ts` | 通用响应壳 | 所有端点返回 `{ success, data?, message?, errorCode? }` |
| `error-codes.spec.ts` | 错误枚举 | errorCode 必须在 spec 列举内，状态码匹配 |

共 **14 个 spec 文件 / 约 70+ 用例**，M1 交付完整实现。

## 共享 fixtures

位于 [`verification/fixtures/`](../fixtures/)：
- `users.json` — 两个预置用户（specter / neo）
- `seed-capsules.ts` — 预置 10 条胶囊（5 已开启 + 5 未开启），跑前用 admin API 或直接 SQL 插入
- `reset-db.sh` — 清 DB 再跑 schema.sql（本地开发用，CI 里通过 docker volume 隔离）

## 运行顺序约束

- `health` → `auth` → `me` → `capsules-*` → `plaza` → `favorites`：部分用例依赖前面的状态
- 每个 spec 自带 `beforeAll` 注册独立用户 / 独立胶囊，不依赖前序 spec（除非显式 `--seq`）
