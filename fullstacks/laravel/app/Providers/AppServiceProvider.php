<?php

namespace App\Providers;

use App\Services\AuthService;
use App\Services\AvatarCatalog;
use App\Services\HealthService;
use App\Support\Formatter;
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
        // 所有 Blade 模板共享：$fmt（展示格式化）、$currentUser（登录态）、$health（页脚技术栈）。
        View::composer('*', function ($view): void {
            $currentUser = null;
            try {
                $currentUser = app(AuthService::class)->currentUser(request());
            } catch (Throwable) {
                $currentUser = null;
            }
            $view->with('fmt', app(Formatter::class))
                ->with('currentUser', $currentUser)
                ->with('health', app(HealthService::class)->health());
        });
    }
}
