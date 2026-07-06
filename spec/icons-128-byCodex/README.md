# HelloTime Pro 128px Stack Icons byCodex

这是一套旁路预览用的大尺寸技术栈 SVG 图标，不替换 `spec/icons/` 中现有的 24px 运行时图标。

## 约定

- 尺寸：统一 `viewBox="0 0 128 128"`，`width/height` 为 128
- 文件名：沿用 `spec/icons/icons.json` 中的 `id`
- 风格：自绘矢量，保留现有赛博几何感，同时提高官方识别度、层次和细节
- 背景：多数图标透明；官方语义强的方块、徽章、圆形图标保留底板
- 用途：适合 about 页、技术栈墙、卡片详情等 64px 以上展示场景

## 预览

直接打开 [`preview.html`](preview.html) 查看当前 24px 图标放大效果和新版 128px 图标的并排对比，也可以打开自包含的 [`preview-sheet.svg`](preview-sheet.svg) 快速看新版总览。

## 说明

这些 SVG 没有接入当前实现；如需正式替换，应另行更新前端引用、静态复制策略和图标索引。
