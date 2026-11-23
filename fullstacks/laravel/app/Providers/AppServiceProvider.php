<?php

namespace App\Providers;

use App\Services\AuthService;
use App\Services\AvatarCatalog;
use App\Services\HealthService;
use App\Support\Formatter;
use App\Support\Mapper;
use Illuminate\Database\Events\ConnectionEstablished;
use Illuminate\Database\SQLiteConnection;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // 头像目录在构造时读盘，单例避免每次解析重复读取。
        $this->app->singleton(AvatarCatalog::class);
    }

    public function boot(): void
    {
        // SQLite 内置 LOWER() 只处理 ASCII；注册 Unicode 版本的 LOWER 支持全字符集大小写不敏感匹配。
        Event::listen(ConnectionEstablished::class, function (ConnectionEstablished $event): void {
            if ($event->connection instanceof SQLiteConnection) {
                $pdo = $event->connection->getPdo();
                if (method_exists($pdo, 'sqliteCreateFunction')) {
                    $pdo->sqliteCreateFunction('LOWER', fn (?string $s) => $s === null ? null : mb_strtolower($s, 'UTF-8'), 1);
                }
            }
        });

        // 所有 Blade 模板共享：$fmt、$currentUser、$currentUserDto、$health、$avatarCatalog。
        View::composer('*', function ($view): void {
            $currentUser = null;
            $currentUserDto = null;
            try {
                $currentUser = app(AuthService::class)->currentUser(request());
                if ($currentUser !== null) {
                    $currentUserDto = app(Mapper::class)->userDto($currentUser);
                }
            } catch (Throwable) {
                $currentUser = null;
                $currentUserDto = null;
            }
            $view->with('fmt', app(Formatter::class))
                ->with('currentUser', $currentUser)
                ->with('currentUserDto', $currentUserDto)
                ->with('health', app(HealthService::class)->health())
                ->with('avatarCatalog', app(AvatarCatalog::class));
        });
    }
}
