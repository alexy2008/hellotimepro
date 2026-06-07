# HelloTime Pro · Laravel 全栈

PHP 8 + **Laravel 13 + Blade + Alpine.js** 的 HelloTime Pro 全栈实现，端口 **7182**。

同一个 Laravel 进程同时提供：

- `/api/v1/*` JSON API：对齐 `spec/api/openapi.yaml`，契约验证以 Bearer token 黑盒访问。
- 服务端渲染 UI：Blade 模板直出 HTML，httpOnly cookie 承载浏览器会话。

这个实现对应 `docs/03-roadmap.md` 中的「Laravel：Blade + Alpine.js；PHP 现代全栈的最佳代表」。

## 技术栈

| 层 | 选型 |
|---|---|
| 语言 | PHP 8.5 |
| 框架 | Laravel 13 |
| 模板 | Blade |
| 渐进增强 | Alpine.js 3 + 少量原生 JS |
| 数据访问 | Laravel DB Query Builder / 事务 |
| 数据库 | PostgreSQL / SQLite 双驱动 |
| 鉴权 | Laravel Hash(bcrypt) + 自实现 HS256 JWT + refresh token rotate |
| 样式 | `spec/styles` 设计令牌产物 `public/css/app.css` |

## 运行

数据库 schema/data 由仓库级脚本维护，Laravel `run` 只启动服务，不迁移、不 seed。

```bash
# PostgreSQL（默认）
./scripts/db reset --seed
./scripts/hello start laravel

# SQLite
DB_DRIVER=sqlite ./scripts/db reset --seed
DB_DRIVER=sqlite ./scripts/hello start laravel
```

打开 <http://127.0.0.1:7182>。

## 构建 / 测试

```bash
cd fullstacks/laravel
./build   # composer install + npm install + 复制 Alpine 本地静态文件
./test    # Laravel 自带 PHPUnit 入口
./run     # 直接启动，端口 7182
```

## 验证

```bash
./verification/scripts/verify-contract.sh laravel
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh laravel
./verification/scripts/verify-ui-smoke.sh laravel
```

## 目录结构

```text
fullstacks/laravel/
  app/
    Http/Controllers/Api/V1/HelloTimeApiController.php  # JSON 契约入口
    Http/Controllers/Web/                              # Blade 页面与表单入口
    Services/HelloTimeService.php                      # 应用服务层
    Exceptions/ApiError.php                            # 契约错误
  resources/views/                                     # Blade 页面/组件
  routes/{api,web}.php                                 # Laravel 路由表
  database/migrations/0001_*_hellotime_schema.php      # spec schema 的 Laravel migration 参考
  public/{css,js,static}/                              # 设计系统 CSS、Alpine、图标、头像
  run / build / test
```

## 实现要点

- Laravel 路由和控制器是 HTTP 边界，业务规则集中在 `HelloTimeService`，便于和其他栈横向对比。
- API 保持 Bearer token 契约；SSR 页面登录后写入 `ht_access` / `ht_refresh` httpOnly cookie，浏览器 fetch `/api/v1/*` 时由服务层解析 cookie 复用同一套 API 鉴权。
- 收藏写操作用事务同步维护 `favorite_count`；前端点击收藏使用同步 XHR，避免「点完马上进入我收藏的」时 SSR 页面查询早于收藏提交。
- Laravel migration 文件用于展示 Laravel 写法；项目验证和本地数据生命周期仍以 `spec/db` + `scripts/db` 为准。

更完整的代码导读见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。
