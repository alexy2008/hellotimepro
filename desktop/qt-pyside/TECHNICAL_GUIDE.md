# HelloTime Pro Qt Quick/QML + PySide6 桌面端技术手册与代码导读

本文面向熟悉 Python、但没系统接触过 **Qt / QML / PySide6 / 声明式 UI + 脚本语言桥接** 的读者。读完后你应能回答:

- 一个 PySide6 app 从 `main.py` 到看到广场页,代码按什么顺序跑。
- QML(视图) 与 Python(逻辑) 怎么互通——context property、QObject、Property/Signal/Slot、信号回主线程。
- 这套客户端和 `frontends/react-ts` 是什么对应关系。
- 想加一个页面 / 状态 / 接口调用,改哪些文件。

> 阅读建议:第 1 节选型;第 2~4 节整体地图与入口链路;第 5 节 QML 核心概念;第 6 节 QML↔Python 桥接(本实现最关键的一节);第 7~11 节分层细讲;第 12 节环境坑;第 13 节常见改动。

## 1. 技术选型与设计特色

本实现是 M5 桌面客户端之一,**视图层用声明式 QML,业务逻辑/状态用 Python**(经 PySide6 绑定),是「成熟 C++ 引擎 + 脚本语言逻辑 + 声明式标记」的经典组合,一套代码跨 Linux/mac/Win。设计特色:

* **QML + Python 双层**:QML 描述「长什么样、怎么响应」,Python 写「数据从哪来、状态怎么变」。两层经 PySide6 的 **QObject + Property/Signal/Slot** 互通。这与 Web 的 HTML+JS 分工神似,但 QML 自带响应式属性绑定。
* **项目首个 Linux 原生桌面**:swiftui 仅 mac、winui3 仅 win、electron/tauri 是 Web 壳,Qt/PySide 是第一个能在 Linux 上原生跑的桌面端(也跨 mac/Win)。与 flutter 同属「自绘引擎、外观非系统原生」,但语言/引擎不同。
* **纯 API 消费者**:直连 `:9080` 复用 `/api/v1` 契约,不新增后端代码。`API_BASE` 环境变量可覆盖。
* **响应式属性**:QML `color: Theme.colors.surface0` 这种绑定,当 `Theme.colors` 变(主题切换),所有用到它的地方自动刷新——声明式、无需手动刷控件。
* **设计令牌 codegen**:`scripts/gen-tokens-qt` 从 `spec/tokens/tokens.json` 生成 `app/theme/palette.py`,经 `ThemeStore.colors` 暴露给 QML。

## 2. 先建立整体地图

职责与 React 前端相同(渲染所有页面、调后端、维护登录/主题/广场状态、守卫受保护路由),区别在视图层用 QML 重建、逻辑层用 Python 重写。

核心目录:

```text
desktop/qt-pyside/
├── pyproject.toml             # 依赖（PySide6），uv 管理（= package.json）
├── run                        # uv sync + codegen + python app/main.py
├── build                      # codegen + uv sync + compileall + import + qmllint
└── app/
    ├── main.py                # 入口：QGuiApplication + QQmlApplicationEngine + 注册 context property
    ├── api_client.py          # 同步 urllib + 解 Envelope + 自动 refresh（= api/client.ts）
    ├── worker.py              # QThreadPool：同步 api 调用丢线程跑，结果信号回主线程
    ├── bridge.py              # ApiBridge：QML 直调的一次性请求 + 剪贴板
    ├── stores/                # QObject store（Property/Signal/Slot）= Zustand
    │   ├── theme.py  auth.py  plaza.py  capsule.py
    ├── theme/palette.py        # ← codegen 产物（勿手改）
    ├── assets/logo.svg
    └── qml/
        ├── Main.qml            # ApplicationWindow + StackView 路由 + 守卫（= router + AuthGate）
        ├── fmt.js              # 倒计时 / 日期 / 距离（= utils/format.ts）
        ├── components/         # 17 个可复用 QML 组件
        └── pages/              # 11 个页面
```

一次「打开广场页」的流向:

```text
python app/main.py
  │
  ▼
main(): QQuickStyle.setStyle("Basic")  ← 必须，否则自定义 Button 报错（§12）
  │ 实例化 ApiClient / 4 个 store / ApiBridge
  ▼
QQmlApplicationEngine.rootContext().setContextProperty("Theme"/"Auth"/"Plaza"/"Capsules"/"Api", …)
  │ 把 Python 对象暴露成 QML 全局变量
  ▼
engine.load("qml/Main.qml") → ApplicationWindow + StackView(initialItem: PlazaPage)
  │ auth.bootstrap()（有 refreshToken 就拉 /me）
  ▼
PlazaPage.Component.onCompleted → Plaza.fetch()（Plaza 是 PlazaStore 的 context property）
  │
  ▼
PlazaStore.fetch(): run_async(api.plaza, on_ok)  → QThreadPool 里同步 urllib 打 :9080
  │ 结果经信号回主线程
  ▼
on_ok: self._items = data["items"]; self.changed.emit()
  │ changed 信号触发 QML 里 items 属性绑定重算
  ▼
Repeater{ model: Plaza.items } 重建 → 卡片网格出现
```

## 3. 如何运行和验证

```bash
./scripts/hello start qt-pyside    # 原生窗口（port:None → hello status 显示 native）
./scripts/hello stop qt-pyside
# 或直接：
cd desktop/qt-pyside && ./run
./build                            # 构建校验
```

`./run`:`uv sync`(装 PySide6 到 `.venv`)→ 跑 `scripts/gen-tokens-qt` 重生成 `palette.py` → `uv run python app/main.py`(前台,关窗即退,`hello` 据进程判活)。`API_BASE` 默认 `:9080`。

`./build`:codegen + `uv sync` + `python -m compileall app`(语法) + 模块导入校验 + `qmllint`(命中 `Error:` 即失败;`Unqualified access` 警告是 context property 的预期误报)。

## 4. 入口链路：`main.py`

```python
def main() -> int:
    QGuiApplication.setApplicationName("HelloTime Pro")
    QQuickStyle.setStyle("Basic")            # ← 关键，见 §12
    app = QGuiApplication(sys.argv)

    api = ApiClient()
    theme, auth = ThemeStore(), AuthStore(api)
    plaza, capsule = PlazaStore(api), CapsuleStore(api, plaza)
    bridge = ApiBridge(api)

    engine = QQmlApplicationEngine()
    ctx = engine.rootContext()
    ctx.setContextProperty("Theme", theme)   # QML 里直接写 Theme.colors.surface0
    ctx.setContextProperty("Auth", auth)
    ctx.setContextProperty("Plaza", plaza)
    ctx.setContextProperty("Capsules", capsule)
    ctx.setContextProperty("Api", bridge)
    ctx.setContextProperty("logoUrl", QUrl.fromLocalFile(.../logo.svg).toString())

    engine.load(QUrl.fromLocalFile(.../qml/Main.qml"))
    auth.bootstrap()
    return app.exec()
```

`setContextProperty(name, obj)` 把 Python 的 QObject 暴露成 QML 的全局对象。QML 里 `Theme.colors`、`Auth.user`、`Plaza.items`、`Api.capsuleByCode(code)` 都是这么来的。

## 5. QML 核心概念（最少必要）

* **QML 是声明式标记**:`Rectangle { width: 100; color: "red"; Text { text: "hi" } }`——对象树 + 属性。
* **属性绑定**:`color: Theme.colors.surface0` 不是赋值一次,而是建立**绑定**:右边变了,左边自动更新。这是响应式的核心。
* **id 与作用域**:`Rectangle { id: box }` 后同文件内可 `box.width` 引用。**但 id 作用域只在单个 .qml 文件内**——跨文件看不到(见 §6 的导航处理)。
* **Item/Rectangle/Text/Image/Row/Column/Layout**:基础视觉与布局元件。`RowLayout`/`ColumnLayout`/`GridLayout` 是会管理子项尺寸的布局(子项用 `Layout.*` 附加属性,不要在里面用 `anchors`)。
* **Component / Repeater / StackView**:`Repeater { model: …; delegate: … }` 按数据生成列表;`StackView` 管页面栈(push/pop/replace)。
* **信号处理**:`onClicked: …`、`Component.onCompleted: …`;跨对象用 `Connections { target: X; function onSomeSignal(a){…} }`。

## 6. QML ↔ Python 桥接（本实现最关键）

三种通路:

1. **context property(状态/主题)**:`main.py` 注册的 `Theme/Auth/Plaza/Capsules`。它们是 Python **QObject**,用 `@Property(type, notify=changed)` 暴露只读属性、`@Slot(...)` 暴露可调用方法、`Signal()` 通知变化。QML 绑定其 Property,Python 改内部值后 `self.changed.emit()`,QML 自动刷新。

   ```python
   class PlazaStore(QObject):
       changed = Signal()
       @Property("QVariant", notify=changed)
       def items(self): return self._items          # QML: model: Plaza.items
       @Slot(str)
       def setSort(self, s):                          # QML: Plaza.setSort("hot")
           self._sort = s; self.changed.emit(); self.fetch()
   ```

2. **ApiBridge(一次性请求)**:那些不归 store 管的请求(按码取详情、AI 建议/推荐、头像列表、创建、health、改资料/密码)走 `bridge.py` 的 `Api` 对象——`@Slot` 发起,结果用 `Signal("QVariant")` 回传,QML 用 `Connections { target: Api; function onCapsuleLoaded(c){…} }` 接。也提供 `avatarUrl`/`resolveAsset`/剪贴板。

3. **异步(worker.py)**:网络是同步阻塞的,不能在主线程跑(会卡 UI)。`run_async(fn, on_ok, on_err)` 把 `fn` 丢进 `QThreadPool`,完成后经信号回主线程更新 state——Qt 跨线程信号默认排队投递,所以 `on_ok` 在主线程执行,改 QObject 安全。

**导航(跨文件作用域陷阱)**:独立 .qml 文件看不到 `Main.qml` 的 `stack`/`win` id。所以导航走根窗口的**附加属性** `ApplicationWindow.window`:任意后代都能 `ApplicationWindow.window.go("plaza")` / `.push("detail", {code})`。当前路由用 `stack.currentItem.route` 绑定(每个页面声明 `property string route`)。

## 7. 数据层：`api_client.py`

同步实现(urllib),由 worker 线程调用,逻辑镜像 React `api/client.ts`:

- `_request(method, path, body, auth)`:拼 URL、带 `Authorization`、解 `Envelope`、失败抛 `ApiError`。
- **refresh 单飞 + 处理轮换竞态**:401 或 access 缺失时,在 `threading.Lock` 内做一次 `/auth/refresh`;进锁后先比对 access token 是否已被别的线程刷新过(`prev_access`),避免「刷新令牌轮换」下的并发重复刷新导致互相吊销。
- token 存取/失效经回调(`get_access_token`/`on_tokens_refreshed`/`on_auth_lost`)由 `AuthStore` 注入,api 不反向依赖 store。

## 8. 状态层：QObject stores

四个 store 对位 React 四个 Zustand store:
- `theme.py`:dark/light + `QSettings` 持久化;暴露 `colors`(dict,主题切换即时刷新)、`sizes`、`gradients`、`fonts`。
- `auth.py`:access 内存、refresh+user 持久化(QSettings + JSON);`setTokens`/`logout`/`bootstrap`/`refreshMe`;`canAccessProtected`(守卫放行条件);构造时把回调挂到 ApiClient。
- `plaza.py`:sort/filter/q/page + items + loading;`fetch` 用自增序列号防乱序。
- `capsule.py`:mine/favorites 两个列表切片 + 分页 + 删除 + `toggleFavorite`(收藏切换并联动 `plaza.patchFavorited`,经 `favoriteChanged` 信号让卡片更新)。

## 9. 路由与外壳：`Main.qml`

`ApplicationWindow` 里 `Column { AppHeader; StackView; AppFooter }`。`StackView` 是页面容器:
- `go(route, props)`:nav 链接用,`replace` 当前页;受保护路由(create/me*)若未登录 → 存 pendingFrom + 跳 login。
- `push(route, props)`:详情/登录入口用,可 `back()` 返回。
- `componentFor(route)` 把路由名映射到页面 Component;`currentRoute` 绑定 `stack.currentItem.route` 供 header 高亮。
- `Connections { target: Auth; onLoginSucceeded }` 登录成功后跳 pendingFrom。

## 10. 页面 / 组件 / 主题

- 页面(`qml/pages/`,11 个):每个是 `ScrollView { ColumnLayout {...} }`,`property string route` 标识,`Component.onCompleted` 触发首屏请求。
- 组件(`qml/components/`,17 个):`HtButton`(变体+尺寸)、`Avatar`(圆形遮罩远程 SVG)、`CapsuleCard`(渐变描边+辉光+hover+倒计时)、`PlazaToolbar`+`Segmented`、`Pagination`、`FavoriteButton`、`CapsuleCodeInput`(8 格)、`FlipClock`、`DateTimePicker`(手动+月历+时分+预设)、`RecommendationStrip`、`AvatarPicker`、`MeSidebar`、`NavLink`、`HtAlert`、`Badge`、`Container`。
- 主题:`gen-tokens-qt` → `palette.py`(DARK/LIGHT 颜色字符串、GRADIENTS、SIZES)。`ThemeStore.colors` 暴露当前主题 dict,QML `color: Theme.colors.X`;尺寸 `Theme.sizes.s4`;渐变 `Theme.gradients.cyberFlow`。颜色含 alpha 的转 `#AARRGGBB`(QML color 接受 8 位十六进制,alpha 在前)。

## 11. 与 React 参考实现的对应

| 层 | React | Qt/PySide（本实现） |
|---|---|---|
| 类型 | `types/index.ts` | dict 直传（JSON data） |
| API | `api/client.ts` | `api_client.py`（同语义） |
| 异步 | async/await | `worker.py`（QThreadPool + 信号回主线程） |
| 状态 | Zustand store | QObject store（Property/Signal/Slot），context property 暴露 |
| 路由/守卫 | React Router + AuthGate | `Main.qml` StackView + `go/push` 守卫 |
| 令牌 | `tokens.css` | codegen `palette.py` → `Theme.colors` |
| 视图 | JSX | QML |

## 12. 环境与已知点

- **必须 `QQuickStyle.setStyle("Basic")`**:macOS 默认原生 Controls 样式不允许自定义 Button 的 `background`/`contentItem`,否则满屏 "current style does not support customization"。
- **QML 跨文件 id 作用域隔离**:独立 .qml 看不到 Main 的 id,导航走 `ApplicationWindow.window`(见 §6)。
- **RowLayout 内别用 anchors**:布局管理的子项用 `Layout.alignment` 等,用 `anchors` 是未定义行为(qmllint 会警告)。
- **退出期 teardown 噪声**:关闭时先销毁 context property(Theme/Auth)再销毁 QML item → 控制台打印一批 `TypeError: Cannot read property '...' of null`,**无害**、非运行期错误。
- 依赖经 `uv`(同 `backends/fastapi`),装到 `.venv`(gitignored)。

## 13. 常见改动指南

- **加一个页面**:`qml/pages/` 新建(带 `property string route`)→ `Main.qml` 的 `componentFor` + `Component` 加映射 → 需要的话在 header/sidebar 加 `ApplicationWindow.window.go("x")`。
- **加一个接口**:`api_client.py` 加方法 → 若属某状态域,在对应 store 加 `@Slot` + `run_async` + Property;若是一次性请求,在 `bridge.py` 加 `@Slot` + `Signal`。
- **加一个状态域**:`stores/` 仿现有 QObject store,在 `main.py` 注册 context property。
- **改设计令牌**:改 `spec/styles/tokens.css`(源)→ 同步 `tokens.json` → 跑 `scripts/gen-tokens-qt`;不要手改 `palette.py`。

## 14. 验证（无 computer-use，编译 + 后端日志）

- `./build`:codegen + compileall + import + qmllint(零 Error 级)。
- 路由巡航:程序化遍历全部 11 路由,运行期零 QML 错误(teardown 噪声除外)。
- 连通:`hello start qt-pyside` 后 fastapi 日志出现 `GET /api/v1/health 200`、`GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/{icons,avatars}/*.svg 200`,佐证 Python → `:9080` 全流程。
