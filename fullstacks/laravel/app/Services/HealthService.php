<?php

namespace App\Services;

use App\Support\CrossDb;

/**
 * 健康检查 + 技术栈自述（2.0）。供 /api/v1/health 与页脚 / 关于页使用。
 */
class HealthService
{
    public function __construct(private readonly CrossDb $db)
    {
    }

    public function health(): array
    {
        $sqlite = $this->db->isSqlite();

        return [
            'status' => 'ok',
            'service' => 'hellotime-pro',
            'version' => '2.0.0',
            // LARAVEL_START 在 public/index.php 中定义为 microtime(true)，代表请求 / 进程启动时刻
            'uptimeSeconds' => (int) max(0, microtime(true) - (defined('LARAVEL_START') ? LARAVEL_START : microtime(true))),
            'stack' => [
                'kind' => 'fullstack',
                'summary' => '基于 PHP 8 与 Laravel 13 实现同源服务端，路由显式集中在 routes/web.php 与 routes/api.php，网页与 API 控制器只做 HTTP 边界与参数校验，核心业务规则统一收束在 app/Services 层以保证双端行为一致。认证层同时支持网页会话与 HS256 JWT 及 Refresh Token 家族轮换，异常处理器按契约统一封装 JSON 外壳。持久层全部经 Eloquent ORM 与自定义跨库 Cast 访问，支持 PostgreSQL 与 SQLite 双库无缝切换。',
                'items' => [
                    ['role' => 'language', 'name' => 'PHP', 'version' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION, 'iconUrl' => '/static/icons/php.svg'],
                    ['role' => 'framework', 'name' => 'Laravel', 'version' => app()->version(), 'iconUrl' => '/static/icons/laravel.svg'],
                    ['role' => 'orm', 'name' => 'Eloquent', 'version' => app()->version(), 'iconUrl' => '/static/icons/laravel.svg'],
                    ['role' => 'template', 'name' => 'Blade', 'version' => app()->version(), 'iconUrl' => '/static/icons/laravel.svg'],
                    ['role' => 'enhancement', 'name' => 'Alpine.js', 'version' => '3', 'iconUrl' => '/static/icons/javascript.svg'],
                    ['role' => 'database', 'name' => $sqlite ? 'SQLite' : 'PostgreSQL', 'version' => $sqlite ? '3' : '16', 'iconUrl' => '/static/icons/' . ($sqlite ? 'sqlite' : 'postgresql') . '.svg'],
                ],
            ],
        ];
    }
}
