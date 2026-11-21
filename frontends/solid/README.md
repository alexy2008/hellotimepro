# HelloTime Pro · SolidJS + TypeScript（2.0）

SolidJS 1.9 + TypeScript + Vite 6 + `@solidjs/router` 0.16 实现的时间胶囊前端，两套皮肤「时笺」「琥珀」× 明暗。
功能与交互对齐参考实现 `frontends/react-ts`，视觉基准是 2.0 原型（`2.0版原型byClaude-合集/`），样式原样引入 `spec/styles`，契约见 `spec/api/openapi.yaml` 2.0.0。
同一套 UI 换成 Solid 的**细粒度响应式**来写：组件只运行一次，Signals / Store 直接驱动真实 DOM，没有虚拟 DOM。

## 快速开始

```bash
# 一次性：起一个后端（默认 FastAPI），把 :9080 指过去
cd ../../
./scripts/db init
./scripts/hello start fastapi
./scripts/hello switch fastapi

# 启动前端（端口 7180）
cd frontends/solid
./run
# → http://localhost:7180
```

也可以跳过 :9080 反代直连后端：`BACKEND_PROXY=http://localhost:29010 ./run`，或用 dev manager：`./scripts/hello start solid`。

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（端口 7180） |
| `./build` | 类型检查（`tsc --noEmit`）+ 生产构建到 `./dist` |
| `./test` | 单元测试（vitest） |

UI 冒烟（两套皮肤各跑一遍）：`./verification/scripts/verify-ui-smoke.sh solid`

## 目录结构

```
src/
├── main.tsx              ← 首次渲染之前恢复登录态，再挂载 <App />
├── App.tsx               ← 路由表（Router 的 root 是总布局）
├── app/Layout.tsx        ← 总布局：按皮肤挑页头 / 页脚 / 底栏，main#view 放页面
├── api/client.ts         ← fetch 封装、统一响应解包、401 自动 refresh 并重放（单飞）
├── types/                ← 与 openapi 2.0.0 对齐的类型（含 PlazaStats / MyStats）
├── stores/               ← 模块级 Signal / Store：auth · ui（皮肤 / 明暗）· plaza · feedback（Toast / 确认框）
├── primitives/           ← 两套皮肤共用的业务逻辑（React 的 hooks 对应物）
│   ├── now               全局整秒节拍
│   ├── plazaHome         首页：/ 聚焦、到点刷新、页码、年鉴数字
│   ├── codeOpen          凭码开启（首页就地输码与开启页共用，经 context 交给输码框）
│   ├── capsule           详情：取数、逐秒倒数、到点后等服务端确认开启（awaitOpened）；我封存过的胶囊
│   ├── capsuleForm       创建：草稿、校验、AI 推荐与代笔、封存
│   └── account           登录 / 注册 / 我的统计与列表（加载更多）/ 资料与密码
├── lib/                  ← 图标、时间说法、头像（内联 spec/avatars/v2）、专属色、关于页文字与技术栈、账号表单规则、登录回跳
├── components/           ← 结构相同、只靠样式换肤的部件：Seg、FavButton、Feedback、forms、shared、shellParts、AuthGate、LoginPrompt
├── skins/
│   ├── paper/            ← 「时笺」：Shell · HomePage · Card · CodeInput · CapsulePages · CreatePage · AccountPages · AboutPages · parts
│   └── amber/            ← 「琥珀」：同上 + Sky（星空粒子）
├── pages/                ← 路由入口：建好本页状态，再用 <Skinned> 按皮肤挑视图
├── solid-jsx.d.ts        ← 补 Solid JSX 类型里缺的几个 SVG 属性
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

- **状态建在路由页，视图按皮肤分**：每个路由页先创建本页的 primitive（`createCapsuleForm()`、`createCodeOpen()`、`createLogin()`…），再交给 `skins/paper` 或 `skins/amber` 的视图。切皮肤只销毁、重建视图，状态原样保留——草稿、填了一半的表单、已输的码、进行中的封存请求都还在；离开路由时整份状态随之销毁，等于清空。表单字段、分段控件、收藏按钮、Toast、确认框只写一份，靠 `spec/styles` 换肤。
- **皮肤与明暗**：`<html data-skin data-theme>` 两个属性，首帧前由 `index.html` 的内联脚本从 `localStorage`（`hellotime.skin` / `hellotime.theme`）写好；切换用 View Transition（换皮肤模糊淡入、换明暗圆形晕开），减少动效时直接切。Solid 的信号写入同步落到 DOM，转场回调返回时新画面已经就绪。
- **样式**：不写组件样式，类名与 DOM 结构照 2.0 原型；本前端只有 `styles/app.css` 两条胶水。时笺的网络字体用 `@fontsource` 自托管。不用 Tailwind。
- **测试钩子**：所有关键元素带 `spec/ui/testids.md` 规定的 `data-testid`；长按封缄可用键盘空格按住完成（完成由定时器驱动，后台标签页不会卡住）。
- **存储策略**：access token 在内存，refresh token 与 user 在 `localStorage`，并在首次渲染前恢复（守卫第一帧就能拿到登录态）；XSS 权衡见 `docs/02-design.md §7.2`。
- **收藏与创建入口**：2.0 起任何胶囊都能收藏；乐观更新、失败回滚；匿名用户点收藏或任一「创建」入口都先弹确认框，再带 `?redirect=` 去登录。

## 2.0 验证

以下结果都在最终代码上取得（升级指南第 2 节第 6 条的复核要求在写代码时一并实现）。

| 项目 | 结果 | 数据库 | 日期 |
|---|---|---|---|
| UI 冒烟（`verify-ui-smoke.sh solid`，paper 44 + amber 44，一次跑完） | ✅ 88/88 | PostgreSQL | 2026-11-21 |
| UI 冒烟（fastapi 以 `DB_DRIVER=sqlite` 重启后再跑，`/health` 确认为 SQLite，跑完已恢复 PostgreSQL） | ✅ 88/88 | SQLite | 2026-11-21 |
| 设计令牌（`verify-design-tokens.sh solid`，扫描 2 个样式文件） | ✅ 通过 | — | 2026-11-21 |
| `./build`（`tsc --noEmit` + `vite build`） | ✅ 通过 | — | 2026-11-21 |
| `./test`（vitest，3 个文件） | ✅ 20/20 | — | 2026-11-21 |

另在内置浏览器里看过：两套皮肤的首页、开启、详情（未开启 → 倒计时归零自动启封）、创建页（时笺的标尺键盘调整与日历）、我的、关于，琥珀的明暗切换与手机宽度底栏。控制台没有 Solid 的告警，只有 dev server 重启时 Vite 的重连日志。

## 2.0 迁移笔记

清单（`docs/05-upgrade-2.0.md` §2）之外，这次在 Solid 上踩到或特意处理的：

1. **状态放在哪一层，决定了切皮肤丢不丢**：React 把表单值放进共享 store、卸载时看地址栏判断「真的离开」。Solid 的组件只运行一次，路由页里 `createXxx()` 出来的状态在切皮肤时根本不会重建，所以登录 / 注册 / 资料 / 密码 / 输码 / 创建都直接建在路由页上，离开路由时随 owner 销毁即清空。「我的」三个页签共用一个路由组件，每个页签的状态建在一个 `createMemo` 里（换页签时旧的随之销毁），建状态的读取用 `untrack` 圈住，否则 `refreshMe` 改了 `auth.user` 会把正在改的资料表单整份重建。
2. **`on(…, { defer: true })` 会丢第一次的旧值**：被 defer 跳过的那一次不记 `prevInput`，第一次登出时回调拿到的旧 id 是 `undefined`，「换账号清草稿」就漏了。`onAccountChange` 不用 defer，第一次运行时旧值为空自然不触发。
3. **JSX 类型的 prop 每读一次就新建一次节点**：Solid 把 `trail={<NickState …/>}` 编译成 getter，`Field` 里「判断有没有 trail」和「渲染 trail」各读一次就是两份节点。用 `children(() => p.trail)` 解析一次共用；`Seg` 的 options（带图标）用 `createMemo` 只读一次。
4. **确认框的正文与插画写成函数**：`confirmDialog({ body: () => <p>…</p> })`，由 `DialogHost` 在自己的组件树里调用。在点击回调里直接写 JSX 的话，其中的动态表达式没有归属的 owner，不会被清理还会报开发期告警。删除确认框里的标题因此照常作为文本插入，不走 `innerHTML`。
5. **受控输入要手动对齐 DOM**：Solid 只在信号值变了时才写 `input.value`。输码框敲了非法字符被丢掉、或小写转大写后值没变，DOM 里会留着那个字符；两套输码框在 `onInput` 里把清洗后的值写回 `el.value`。琥珀输码框同时采用「一次进来整串 8 位码（`InputEvent.data`）就从头填」，不依赖自动聚焦的时序。
6. **同一路由换参数不会重建组件**：从 `/capsules/A` 跳到 `/capsules/B`，路由组件原地复用。详情页按 `code` 套一层 keyed `<Show>`，换码就整份状态重建，旧请求与轮询一起作废（相当于 React 的 `key={code}`）。
7. **重播 CSS 动画**：React 靠改 `key` 重新挂载。Solid 里翻页数字、翻牌倒计时的每一位用 keyed `<Show when={digit}>` 包住，数字变了就重建那个 `<span>`；收藏按钮的 `is-pop` 用 `classList` 先摘掉、强制回流（`el.offsetWidth`）再加回，不重建按钮、不丢焦点。
8. **样式对象与 React 不同**：键用 kebab-case（`"border-radius"`、`"animation-delay"`），数值不会自动补 `px`（骨架宽高、标尺刻度位置、滑块宽度都要写单位）；自定义属性 `"--i"` 可以直接给数字。
9. **路由器的点击拦截在委托事件之后**：`@solidjs/router` 先调 `delegateEvents(["click"])` 再挂自己的 `click` 监听，所以 `CreateLink` 在 `onClick` 里 `preventDefault()` 就能挡住匿名用户的跳转、先弹确认框。`navigate("/login?redirect=%2Fcreate")` 与 `<Navigate href>` 都原样保留查询串编码，守卫首帧调用也能正常跳转。
10. **Solid 的 JSX 类型缺几个 SVG 属性**：`textPath` 的 `textLength` / `lengthAdjust`、`svg` 的 `focusable`。用 `src/solid-jsx.d.ts` 做模块扩充，标记与原型保持一致。keyed `<Show>` 的子函数类型要求必须声明参数（`RequiredParameter`），不需要的参数也要写出来。
11. **搜索防抖放在广场 store**：输入值 `qInput` 与 300ms 计时器都在 `stores/plaza`，输入后不到 300ms 就切皮肤也不丢字（与 Vue 的做法一致）。
12. **`/me` 单飞**：启动时的登录态校验与资料保存后的刷新可能同时要 `/me`，`refreshMe()` 共用一个进行中的请求。
