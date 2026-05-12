# 技术栈图标集

`/api/v1/health` 返回的 `stack.items[].iconUrl` 指向这些图标。

## 约定

- **尺寸**：统一 `viewBox="0 0 24 24"`（`width/height` 属性也为 24）
- **填色**：单色或渐变；避免依赖外部字体
- **背景**：多数图标默认无背景（透明），由 UI 容器决定底色
- **命名**：小写 kebab-case，与 `icons.json` 中的 `id` 一致
- **来源**：**本项目自绘**的赛博几何抽象风格（不使用 Simple Icons 等外部资源，以确保许可纯净）

## 工作流

1. 每个后端 / 全栈实现在启动时把 `spec/icons/` **复制或软链**到自己的静态目录
2. 通过 `/static/icons/<name>.svg` 对外暴露
3. `/api/v1/health` 返回的 `iconUrl` 形如 `"/static/icons/fastapi.svg"`
4. 前端直接 `<img src="{backendBaseUrl}{iconUrl}">` 即可

## 图标清单

见 [`icons.json`](icons.json)。

若实现用到的技术没有对应图标，可按以下顺序处置：

1. 先到 `spec/icons/icons.json` 提 PR 加一个条目并补图
2. 过渡期：把 `iconUrl` 设为 `null`，前端自动降级为文字标签
3. **不允许**各实现自造不合并回 spec 的图标（会让 UI 漂移）

## 风格指南（新增图标时）

- 只用 2–3 个几何元素，一眼可辨
- 主色尽量取各技术官方色（但图形自绘，不复刻 logo）
- 避免 `<text>` 依赖系统字体——必须用字符时，用 `font-family="system-ui, sans-serif"` 兜底
