<?php

namespace App\Providers;

use App\Services\HelloTimeService;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        View::composer('*', function ($view): void {
            $hello = app(HelloTimeService::class);
            $currentUser = null;
            try {
                $currentUser = $hello->currentUser(request());
            } catch (Throwable) {
                $currentUser = null;
            }
            $view->with('hello', $hello)
                ->with('currentUser', $currentUser)
                ->with('health', $hello->health());
        });
    }
}
