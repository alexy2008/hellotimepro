# spec/styles · 2.0 样式规范

两套皮肤「时笺」（`paper`）与「琥珀」（`amber`），各有明暗两色。所有 Web 前端与全栈原样引入这里的文件，不复制、不改写。设计原则见 [`docs/02-design.md` §9.3](../../docs/02-design.md)。

## 文件

| 文件 | 内容 |
|---|---|
| `base.css` | 皮肤无关的刻度：`--space-*`、`--text-*`、`--ease-*`、`--dur-*`、`--z-*`、版心。不含颜色 |
| `paper/tokens.css` · `amber/tokens.css` | 皮肤令牌：私有令牌（原型命名）+ **语义层**（两套同名同集合） |
| `paper/components.css` · `amber/components.css` | 基础排版、外壳（页头 / 页脚 / 底栏）、可复用部件 |
| `paper/pages.css` · `amber/pages.css` | 各页面版式与仪式性动画（封缄、开启、回执…） |
| `shell.css` | 两套皮肤共用的外壳：皮肤切换开关、皮肤转场 |
| `build_tokens.py` | 生成 `spec/tokens/skins.json`；`--check` 只校验 |

## 引入顺序

```html
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="paper/tokens.css">
<link rel="stylesheet" href="paper/components.css">
<link rel="stylesheet" href="paper/pages.css">
<link rel="stylesheet" href="amber/tokens.css">
<link rel="stylesheet" href="amber/components.css">
<link rel="stylesheet" href="amber/pages.css">
<link rel="stylesheet" href="shell.css">
```

打包工具里用 `@import` 按同样顺序引入即可。`<html>` 上必须在首帧前写好 `data-skin` 与 `data-theme`（见 `docs/02-design.md` §9.3）。

## 三条规矩

1. **每条规则都按皮肤限定**：选择器以 `:root[data-skin="<skin>"]` 开头，`@keyframes` 以 `<skin>-` 开头。所以两套可以同时加载，切换皮肤只改属性。新增规则必须遵守。
2. **类名与 DOM 结构以 2.0 原型为准**：[`2.0版原型byClaude-合集`](../../2.0版原型byClaude-合集/) 直接引用本目录，它就是这些样式的活样本。实现某个组件时，照原型里对应皮肤的模板写出同样的结构与类名。
3. **实现自己写的样式只能用语义层**：`--color-*`、`--bg-primary`、`--font-display|body|mono|latin`、`--radius-sm|md|lg|pill`、`--shadow-card|pop`、`--header-h`，加上 `base.css` 的刻度。私有令牌（`--seal`、`--ink`、`--amber`、`--text-2`…）只给本目录用；实现代码里不写色值字面量。

## 语义层一览

| 令牌 | 时笺 | 琥珀 |
|---|---|---|
| `--color-bg` / `--color-surface` | 宣纸白 / 信纸 | 夜空 / 卡片 |
| `--color-text` · `-2` · `-3` | 焦墨 · 浓墨 · 淡墨 | 主文 · 次文 · 辅助 |
| `--color-accent` | 朱砂 | 琥珀金 |
| `--bg-primary` / `--color-on-primary` | 墨色实底 / 纸色字 | 琥珀渐变 / 深棕字 |
| `--color-sealed` / `--color-opened` | 朱砂 / 黛蓝 | 琥珀 / 绿 |
| `--color-favorite` | 朱砂 | 玫红 |
| `--color-highlight`（AI、热度） | 藤黄 | 星紫 |
| `--color-danger` | 朱砂 | 珊瑚红 |

完整的 44 个令牌及其在四种组合下展开后的值见 [`spec/tokens/skins.json`](../tokens/skins.json)。

## 修改流程

1. 改 `tokens.css` / `components.css` / `pages.css`；
2. 在原型里两套皮肤、明暗都看一遍；
3. 运行 `python3 spec/styles/build_tokens.py` 重新生成 JSON（改了语义层时必须）；
4. `python3 spec/styles/build_tokens.py --check` 通过后再提交。

## 1.x 遗留

`palette.css`、`tokens.css`、`cyber.css` 与 `spec/tokens/tokens.json` 属于 1.x，还被尚未升级的实现引用：20 个 Web 实现迁到 2.0 后删除前三个；`tokens.json` 等桌面端与移动端在下一轮升级后删除。新代码不要再引用它们。
