# 界面测试钩子契约（2.0.0）

> UI 冒烟（`verification/ui`）**只**通过本文规定的 `data-testid` 与状态属性定位元素，不读类名，不依赖按钮文案和 DOM 层级。
> 每个前端 / 全栈、每套皮肤（`paper`、`amber`）都 MUST 提供完全相同的钩子。皮肤可以自由决定长什么样，但钩子一个都不能少。
>
> 改动本文件等同于改契约：先改这里，再改实现与用例。

---

## 1. 通用约定

1. **写法**：`data-testid="kebab-case"`，全小写，用连字符。
2. **挂在可交互的元素本身上**：要点击的挂在 `<button>` / `<a>` 上，要输入的挂在 `<input>` / `<textarea>` 上，不挂在外层包装上。
3. **重复元素同名**：列表项（卡片、行、选项）用同一个 testid 重复出现，用 `data-code`、`data-value` 等属性区分。
4. **页面上同一时刻只有一个**：非列表类的钩子在 DOM 中 MUST 唯一（隐藏的副本也不行）。桌面头部导航与手机底部标签栏因此用不同的前缀（`nav-*` / `tab-*`）。
5. **状态用属性表达，不用文案**：

   | 属性 | 取值 | 用在 |
   |---|---|---|
   | `data-state` | `sealed` \| `opened` | 胶囊卡片、详情、列表行 |
   | `data-code` | 8 位胶囊码 | 任何代表一枚胶囊的元素 |
   | `data-in-plaza` | `true` \| `false` | 详情、我创建的、我收藏的行 |
   | `data-selected` | `true` \| `false` | 分段控件选项、开启时间预设、头像选项 |
   | `data-value` | 字符串 / 数字 | 统计数字、选项值 |
   | `data-count` | 整数 | 筛选项数量、收藏数、二级菜单数量 |
   | `aria-pressed` | `true` \| `false` | 收藏按钮 |
   | `aria-current` | `page` | 「我的」二级菜单当前项 |

6. **皮肤与明暗**：当前值只读 `<html data-skin>` 与 `<html data-theme>`，测试不从界面文字推断。
7. **测试环境**：Playwright 视口 1280×800、`reducedMotion: 'reduce'`、`locale: 'zh-CN'`。皮肤通过在页面脚本运行前写入 `localStorage['hellotime.skin']` 指定。

## 2. 交互约定

| 编号 | 约定 |
|---|---|
| X1 | **减少动效时要快**：`prefers-reduced-motion: reduce` 下，封缄仪式、开启动画、皮肤 / 明暗转场 MUST 在 500ms 内结束，结束后元素即可交互。 |
| X2 | **长按控件可用键盘完成**：`create-submit` 若做成长按，MUST 在获得焦点时响应「按下空格开始、松开空格结束」，所需时长 ≤ 1200ms；松开过早则不提交。测试统一用 `press('Space', { delay: 1500 })` 触发——普通按钮在空格松开时触发 click，天然满足。 |
| X3 | **输码可整段填入**：对第一个 `code-cell` 一次性填入 8 位码（`fill`），MUST 自动分发到 8 格并自动查询；逐格输入同样可用。小写自动转大写，非 `[A-Z0-9]` 字符丢弃。`quick-open-input` 同理（它是单个输入框）。 |
| X4 | **搜索防抖 ≤ 400ms**：`plaza-search` 输入后 400ms 内发起请求，列表与 `filter-option` 的 `data-count` 一并更新。 |
| X5 | **切换皮肤 / 明暗**：点击 `skin-option[data-value=…]` 切到指定皮肤，点击 `theme-toggle` 在明暗间切换；点击后 500ms 内 `<html>` 上的属性 MUST 已更新，且路由、表单内容、广场筛选不变。 |
| X6 | **确认框**：`confirm-dialog` 为 `role="dialog"`、`aria-modal="true"`；`Esc` 等同于 `confirm-cancel`。 |
| X7 | **登录回跳**：访问需登录的页面时直接跳 `/login?redirect=<path>`；匿名点击收藏或创建入口时，MUST 先弹出 `confirm-dialog` 提示登录，`confirm-ok` 后再跳。`redirect` 原样保留在 URL 上，登录 / 注册成功后跳回。 |
| X8 | **异步就绪**：列表加载完成前不渲染 `capsule-card`（可渲染骨架，骨架不带该 testid）；空列表渲染 `list-empty`。 |

## 3. 钩子清单

「必有」列：**M** = MUST，**C** = 条件满足时 MUST 出现（条件写在说明里）。

### 3.1 外壳（所有页面）

| testid | 元素 | 必有 | 说明 |
|---|---|---|---|
| `nav-plaza` | a | M | 头部导航：广场（`/`） |
| `nav-open` | a | M | 头部导航：开启（`/open`） |
| `nav-create` | a | M | 头部导航：创建（`/create`） |
| `nav-me` | a | C | 已登录：我的（`/me/created`） |
| `nav-about` | a | M | 头部或页脚：关于（`/about`） |
| `nav-login` | a | C | 未登录：登录 |
| `user-menu` | button | C | 已登录：用户菜单开关，带 `data-nickname="<昵称>"`；点击后展开菜单 |
| `logout` | button | C | 用户菜单展开后可见：登出 |
| `skin-option` | button / `role="radio"` | M | 皮肤单选组里的两个选项，`data-value="paper\|amber"`，带 `data-selected`（见 X5） |
| `theme-toggle` | button / `role="switch"` | M | 明暗开关（见 X5） |
| `tab-plaza` `tab-open` `tab-create` `tab-me` | a | C | 手机宽度下的底部标签栏；桌面宽度下可以不渲染 |
| `toast` | 任意 | C | 每条提示一个，带 `data-tone="success\|error\|info"` |
| `confirm-dialog` | 任意 | C | 确认框根元素 |
| `confirm-ok` / `confirm-cancel` | button | C | 确认框的确认 / 取消 |
| `footer-stack` | 任意 | M | 页脚技术栈区域，内含若干 `stack-item`（带 `data-name`） |
| `not-found` | 任意 | C | 未匹配路由的 404 页 |

### 3.2 首页 `/`

| testid | 元素 | 必有 | 说明 |
|---|---|---|---|
| `home-create` | a / button | M | hero 区「创建胶囊」入口；未登录时点击跳登录（X7） |
| `quick-open-input` | input | M | 就地输码（X3）；命中后进入 `/capsules/:code` |
| `quick-open-error` | 任意 | C | 未命中时出现 |
| `plaza-stats` | 任意 | M | 广场概览容器 |
| `stat` | 任意 | M | 概览里的每一项，带 `data-key="all\|unopened\|opened\|farthestYear"` 与 `data-value`；`farthestOpenAt` 为 null 时 `farthestYear` 不渲染 |
| `plaza-search` | input | M | 搜索框（X4） |
| `sort-option` | button | M | 排序选项，`data-value="new\|hot"`，带 `data-selected` |
| `filter-option` | button | M | 筛选选项，`data-value="all\|opened\|unopened"`，带 `data-selected` 与 `data-count` |
| `capsule-card` | article / li | M | 每张卡片，带 `data-code`、`data-state` |
| `card-open` | a | M | 卡片内进入详情的链接，`href` 指向 `/capsules/<code>` |
| `card-title` | 任意 | M | 卡片内标题文字 |
| `fav-button` | button | M | 卡片内收藏按钮，带 `aria-pressed` 与 `data-count` |
| `plaza-next` | button / a | C | 还有下一页时出现（翻页或加载更多） |
| `list-empty` | 任意 | C | 列表为空（含搜索无结果） |
| `list-error` / `list-retry` | 任意 / button | C | 加载失败与重试 |

### 3.3 开启页 `/open`

| testid | 元素 | 必有 | 说明 |
|---|---|---|---|
| `code-cell` | input | M | 8 个，按顺序（X3） |
| `open-error` | 任意 | C | 查不到时出现 |
| `my-sealed` | 任意 | C | 已登录且创建过胶囊时出现 |
| `my-sealed-item` | a | C | 每一项，带 `data-code`、`data-state`，至多 3 个 |

### 3.4 胶囊详情 `/capsules/:code`

| testid | 元素 | 必有 | 说明 |
|---|---|---|---|
| `capsule-detail` | 任意 | C | 找到时出现，带 `data-code`、`data-state`、`data-in-plaza` |
| `detail-title` | 任意 | C | 标题 |
| `detail-content` | 任意 | C | 正文，仅 `data-state="opened"` 时出现 |
| `countdown` | 任意 | C | 倒计时，仅 `data-state="sealed"` 时出现，带 `data-open-at="<ISO 8601>"`；归零后自动切换为已开启 |
| `fav-button` | button | C | 收藏按钮（含未公开胶囊），带 `aria-pressed` 与 `data-count` |
| `copy-code` / `copy-link` | button | C | 复制胶囊码 / 复制链接 |
| `detail-not-found` | 任意 | C | 查不到时出现 |

### 3.5 创建页 `/create`

| testid | 元素 | 必有 | 说明 |
|---|---|---|---|
| `create-title` | input | M | 标题 |
| `create-content` | textarea | M | 正文 |
| `openat-preset` | button | M | 开启时间预设，`data-value` 至少包含 `1m`（约 2 分钟后，用于体验开启）、`tm`（明早 9 点）、`1mo`、`1y`（默认选中）、`5y`、`10y`；带 `data-selected` |
| `create-openat` | 任意 | M | 当前选定的开启时刻，带 `data-value="<ISO 8601>"` |
| `create-in-plaza` | input[type=checkbox] / `role="switch"` | M | 是否发布到广场，默认开启；状态用 `checked` 或 `aria-checked` |
| `create-submit` | button | M | 封存（X2） |
| `field-error` | 任意 | C | 校验失败时出现，带 `data-field="title\|content\|openAt"` |
| `ai-reco` | 任意 | C | 推荐主题区；推荐为空或标题非空时不渲染 |
| `reco-chip` | button | C | 每个推荐主题 |
| `reco-refresh` | button | C | 换一批 |
| `ai-generate` | button | M | AI 生成（标题可空） |
| `sealed-receipt` | 任意 | C | 封存完成后出现，带 `data-code` |
| `receipt-view` | a | C | 回执里进入该胶囊详情 |
| `receipt-again` | button | C | 回执里再写一枚 |
| `copy-code` / `copy-link` | button | C | 回执里的复制按钮（与详情页同名） |

### 3.6 登录 `/login` 与注册 `/register`

| testid | 元素 | 必有 | 说明 |
|---|---|---|---|
| `login-email` / `login-password` | input | M | 登录表单 |
| `login-submit` | button | M | 登录 |
| `login-error` | 任意 | C | 登录失败的提示 |
| `to-register` / `to-login` | a | M | 两页互相切换的链接（保留 `redirect`） |
| `register-email` / `register-nickname` / `register-password` | input | M | 注册表单 |
| `nickname-state` | 任意 | C | 昵称唯一性检查结果，带 `data-state="checking\|available\|taken"` |
| `avatar-option` | button / `role="radio"` | M | 10 个头像选项，带 `data-value="<avatarId>"` 与 `data-selected`；注册页与资料页同名 |
| `register-submit` | button | M | 注册 |

### 3.7 我的 `/me/*`

| testid | 元素 | 必有 | 说明 |
|---|---|---|---|
| `me-stat` | 任意 | M | 页头统计每一项，带 `data-key`（取 `MyStats` 字段名）与 `data-value`；至少有 `created`、`unopened`、`favoritesReceived` |
| `me-tab-created` / `me-tab-favorites` / `me-tab-profile` | a | M | 二级菜单，当前项带 `aria-current="page"`；前两项带 `data-count` |
| `my-capsule` | 任意 | C | 「我创建的」每一行，带 `data-code`、`data-state`、`data-in-plaza`；内含一个进入详情的链接 `row-open` |
| `delete-capsule` | button | C | 每个 `my-capsule` 里都有（含已开启的），点击弹出 `confirm-dialog` |
| `fav-item` | 任意 | C | 「我收藏的」每一行，带 `data-code`、`data-state`、`data-in-plaza`；内含 `row-open` 与 `fav-button` |
| `row-open` | a | C | 行内进入详情的链接，`href` 指向 `/capsules/<code>` |
| `list-empty` | 任意 | C | 列表为空 |
| `profile-nickname` | input | M | 资料页昵称 |
| `profile-save` | button | M | 保存资料；无改动时保存给出 `toast`（`data-tone="info"`） |
| `pwd-current` / `pwd-new` / `pwd-confirm` | input | M | 修改密码 |
| `pwd-submit` | button | M | 提交修改密码；两次新密码不一致时出现 `field-error[data-field="confirm"]` 且不发请求 |

### 3.8 关于 `/about`

| testid | 元素 | 必有 | 说明 |
|---|---|---|---|
| `about-features` | 任意 | M | 「它能做什么」，内含 6 个 `about-feature` |
| `about-tenets` | 任意 | M | 「四条原则」，内含 4 个 `about-tenet` |
| `about-stack` | 任意 | M | 本实现技术栈，内含若干 `stack-item`（带 `data-name`） |

## 4. 冒烟用例与钩子的对应（摘要）

| 场景 | 主要钩子 |
|---|---|
| 注册并进入创建页 | `register-*`、`avatar-option`、`register-submit` |
| 登录 / 错误密码 / 登出 | `login-*`、`login-error`、`user-menu`、`logout` |
| 登录回跳 | `fav-button`（匿名）→ `confirm-dialog` → `confirm-ok` → URL 上的 `redirect` → `login-submit` |
| 创建胶囊并在广场检索到 | `create-*`、`openat-preset`、`create-submit`、`sealed-receipt`、`plaza-search`、`capsule-card` |
| 就地输码 / 开启页输码 | `quick-open-input`、`code-cell`、`capsule-detail` |
| 未开启隐藏正文 | `capsule-detail[data-state=sealed]`、`countdown`、无 `detail-content` |
| 收藏后出现在「我收藏的」；收藏自己的 | `fav-button[aria-pressed]`、`fav-item` |
| 删除确认 | `delete-capsule`、`confirm-dialog`、`confirm-ok` |
| 统计 | `stat`、`filter-option[data-count]`、`me-stat` |
| 切换皮肤 / 明暗后状态保留 | `skin-option`、`theme-toggle`、`create-title` 的值、`plaza-search` 的值 |
| AI 推荐与生成（route mock） | `ai-reco`、`reco-chip`、`reco-refresh`、`ai-generate` |
| 资料与密码 | `profile-*`、`pwd-*`、`field-error`、`toast` |
