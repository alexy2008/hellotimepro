<?php

namespace App\Services;

use App\Support\CrossDb;

/**
 * 健康检查 + 技术栈自述。供 /api/v1/health 与页面页脚使用。
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
            'version' => '0.1.0',
            // LARAVEL_START 在 public/index.php 中定义为 microtime(true)，代表进程启动时刻
            'uptimeSeconds' => (int) max(0, microtime(true) - (defined('LARAVEL_START') ? LARAVEL_START : microtime(true))),
            'stack' => [
                'kind' => 'fullstack',
                'summary' => '基于 PHP 8 + Laravel 13 的服务端渲染全栈实现。Laravel 路由与控制器同时承载 /api/v1 JSON 契约和 Blade 页面；Blade 负责服务端渲染，Alpine.js 与少量原生脚本提供主题、菜单、AI 灵感、8 位码输入、收藏和资料页渐进增强。持久层使用 Laravel DB Query Builder 与事务，schema 由仓库级 scripts/db 按 spec/db 统一维护，运行时支持 PostgreSQL 与 SQLite 双驱动。SSR 会话使用 httpOnly cookie，API 仍兼容 Bearer token；浏览器 fetch 可通过 cookie 鉴权复用同一套 API 控制器。密码使用 Laravel Hash(bcrypt)，JWT HS256 与 refresh token 家族轮转/吊销在应用服务层实现。',
                'items' => [
                    ['role' => 'language', 'name' => 'PHP', 'version' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION, 'iconUrl' => '/static/icons/php.svg'],
                    ['role' => 'framework', 'name' => 'Laravel', 'version' => app()->version(), 'iconUrl' => '/static/icons/laravel.svg'],
                    ['role' => 'template', 'name' => 'Blade', 'version' => app()->version(), 'iconUrl' => '/static/icons/laravel.svg'],
                    ['role' => 'enhancement', 'name' => 'Alpine.js', 'version' => '3', 'iconUrl' => '/static/icons/javascript.svg'],
                    ['role' => 'database', 'name' => $sqlite ? 'SQLite' : 'PostgreSQL', 'version' => $sqlite ? '3' : '16', 'iconUrl' => '/static/icons/' . ($sqlite ? 'sqlite' : 'postgresql') . '.svg'],
                ],
            ],
        ];
    }
}
