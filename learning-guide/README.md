# HelloTime Pro · 图文学习资料（HTML）

针对本项目「多技术栈对比学习」的定位，整理出的一套**图文并茂、易于阅读**的 HTML 学习资料。
内容**全部来自仓库内 `docs/` / `spec/` 文档与各实现的 `TECHNICAL_GUIDE.md`**（不读源码），
组织为 **4 页总览 + 20 页单栈详解**。

## 打开方式

直接用浏览器打开 `index.html` 即可（纯静态，无需构建 / 无外部依赖）：

```bash
open learning-guide/index.html          # macOS
# 或起个本地静态服务器
npx serve -p 5599 learning-guide
```

## 四页结构

| 页面 | 内容 | 素材来源 |
|---|---|---|
| [`index.html`](index.html) | **总体介绍** — 项目定位、业务场景、角色旅程、架构总览、端口、三条主线 | `README.md` · `01-requirements.md` |
| [`design.html`](design.html) | **设计** — 数据模型 ER 图、API 契约、鉴权轮转、双库策略、设计令牌、内置头像 | `02-design.md` · `auth.md` · `db-schema.md` |
| [`comparison.html`](comparison.html) | **前后端对比** — 后端十家 / 前端五家 / 全栈五家横向对比，含 LOC、谱系、招牌坑图表 | `backend/frontend/fullstack-comparison.md` |
| [`implementations.html`](implementations.html) | **实现详解** — 20 张实现卡片（技术栈 / 定位 / 亮点 / 取舍 / 评审打分），每张链接到独立详解页 | `backend/frontend/fullstack-review.md` |

## 二十页单栈详解（`stacks/`）

每个栈一页，从其 `TECHNICAL_GUIDE.md` 展开，含整体地图、分层架构、核心机制深读（配 SVG 图）、
从真实请求读代码、招牌坑与改动指南。从 `implementations.html` 每张卡片底部的「阅读详解」进入。

| 组别 | 页面 |
|---|---|
| 后端 · 10 | `stacks/{fastapi,spring-boot,gin,nest,elysia,ktor,aspnet,vapor,axum,drogon}.html` |
| 前端 · 5 | `stacks/{react,vue,angular,svelte,solid}.html` |
| 全栈 · 5 | `stacks/{next,nuxt,spring-mvc,rails,laravel}.html` |

## 资源

- `assets/style.css` — 赛博主题样式（配色对齐 `spec/styles/palette.css`）
- `assets/logo.svg`、`assets/avatars/*.svg` — 项目 logo 与 10 个内置头像
- `assets/icons/*.svg` — 各技术栈图标（源自 `spec/icons/`）

所有图示（架构图、ER 图、鉴权流程、谱系轴、柱状图）均为内联 SVG，离线可读。
