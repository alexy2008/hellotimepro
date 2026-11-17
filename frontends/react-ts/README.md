# HelloTime Pro · React + TypeScript（参考前端，2.0）

参考前端实现：React 19 + TypeScript + Vite 6 + Zustand + react-router 7，两套皮肤「时笺」「琥珀」× 明暗。
视觉基准是 2.0 原型（`2.0版原型byClaude-合集/`），样式原样引入 `spec/styles`，契约见 `spec/api/openapi.yaml` 2.0.0。

## 快速开始

```bash
# 一次性：起一个后端（默认 FastAPI），把 :9080 指过去
cd ../../
./scripts/db init
./scripts/hello start fastapi
./scripts/hello switch fastapi

# 启动前端（端口 7174）
cd frontends/react-ts
./run
# → http://localhost:7174
```

也可以跳过 :9080 反代直连后端：`BACKEND_PROXY=http://localhost:29010 ./run`

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（端口 7174） |
| `./build` | 类型检查 + 生产构建到 `./dist` |
| `./test` | 单元测试（vitest） |

UI 冒烟（两套皮肤各跑一遍）：`./verification/scripts/verify-ui-smoke.sh react`

## 目录结构

```
src/
├── api/client.ts         ← fetch 封装、统一响应解包、401 自动 refresh 并重放（单飞）
├── types/                ← 与 openapi 2.0.0 对齐的类型（含 PlazaStats / MyStats）
├── stores/               ← Zustand：auth · ui（皮肤 / 明暗）· plaza · feedback（Toast / 确认框）
├── hooks/                ← 两套皮肤共用的业务逻辑
│   ├── usePlazaHome      首页：防抖搜索、/ 聚焦、到点刷新、年鉴数字
│   ├── useCodeOpen       凭码开启（首页就地输码与开启页共用）
│   ├── useCapsule        详情：取数、逐秒倒数、到点 expired；我封存过的胶囊
│   ├── useCreateCapsule  创建：草稿、校验、AI 推荐与代笔、封存
│   ├── useAccount        登录 / 注册 / 我的统计与列表 / 资料与密码
│   └── useNow            全局整秒节拍
├── lib/                  ← 图标、时间说法、头像（内联 spec/avatars/v2）、专属色、关于页文字、登录回跳
├── components/           ← 结构相同、只靠样式换肤的部件：Seg、FavButton、Feedback、forms、shared、AuthGate
├── skins/
│   ├── paper/            ← 「时笺」：Shell · HomePage · Card · CapsulePages · CreatePage · AccountPages · AboutPages · parts
│   └── amber/            ← 「琥珀」：同上 + Sky（星空粒子）
├── pages/                ← 路由入口：按当前皮肤挑视图（逻辑都在 hooks 里）
├── app/Layout.tsx        ← 总布局：按皮肤挑页头 / 页脚 / 底栏，main#view 放页面
├── router.tsx            ← 路由表（与 docs/01-requirements.md §4.9 一致）
└── styles/
    ├── index.css         ← 自托管字体 + spec/styles（base → 时笺 → 琥珀 → shell）
    └── app.css           ← 本前端唯一的样式胶水（只用语义令牌）
```

## 路由

| 路由 | 页面 | 权限 |
|---|---|---|
| `/` | 首页：广场概览 + 就地输码 + 胶囊广场 | 公开 |
| `/open` | 凭码开启（登录后附「我封存过的胶囊」） | 公开 |
| `/capsules/:code` | 胶囊详情（倒计时归零自动开启） | 公开 |
| `/create` | 写一枚胶囊 | 登录 |
| `/login` · `/register` | 登录 / 注册（支持 `?redirect=`） | 公开 |
| `/me/created` · `/me/favorites` · `/me/profile` | 我的 | 登录 |
| `/about` | 关于 | 公开 |

## 设计要点

- **逻辑一份，视图按皮肤分**：业务逻辑都在 `hooks/` 与 `stores/`；结构差异大的视图（卡片、首页、详情、创建、账号、关于、外壳）在 `skins/paper` 与 `skins/amber` 各一份；表单字段、分段控件、收藏按钮、Toast、确认框只写一份，靠 `spec/styles` 换肤。
- **皮肤与明暗**：`<html data-skin data-theme>` 两个属性，首帧前由 `index.html` 的内联脚本从 `localStorage`（`hellotime.skin` / `hellotime.theme`）写好；切换用 View Transition（换皮肤模糊淡入、换明暗圆形晕开），减少动效时直接切。切换时路由、草稿、广场筛选都不丢。
- **样式**：不写组件样式，类名与 DOM 结构照 2.0 原型；本前端只有 `styles/app.css` 一行胶水。时笺的网络字体用 `@fontsource` 自托管。
- **测试钩子**：所有关键元素带 `spec/ui/testids.md` 规定的 `data-testid`；长按封缄可用键盘空格按住完成（完成由定时器驱动，后台标签页不会卡住）。
- **存储策略**：access token 在内存，refresh token 与 user 在 `localStorage`，并在首次渲染前恢复（守卫第一帧就能拿到登录态）；XSS 权衡见 `docs/02-design.md §7.2`。
- **收藏**：2.0 起任何胶囊都能收藏；乐观更新、失败回滚；匿名用户先弹确认框，再带 `?redirect=` 去登录。

## 验证

- 单元测试：`./test`（时间说法、专属色、登录回跳）
- UI 冒烟：39 条 × 两套皮肤 = 78 条，PostgreSQL 与 SQLite 下均通过（2026-11-18）
