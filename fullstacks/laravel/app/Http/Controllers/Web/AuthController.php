<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use App\Services\AvatarCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * 认证页面控制器（2.0）：已登录访问 /login 或 /register 时在服务端直接 302 离开，
 * 登录、注册与登出表单由前端同源调 /api/v1/auth/* 并自动同步 httpOnly cookie。
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly AvatarCatalog $avatars,
    ) {
    }

    public function loginForm(Request $request): View|RedirectResponse
    {
        if ($this->auth->currentUser($request)) {
            return redirect('/');
        }
        return view('pages.login', [
            'pageTitle' => '登录 · HelloTime Pro',
            'routeName' => 'login',
            'navKey' => 'me',
            'initData' => [
                'redirect' => $request->query('redirect'),
            ],
        ]);
    }

    public function registerForm(Request $request): View|RedirectResponse
    {
        if ($this->auth->currentUser($request)) {
            return redirect('/');
        }
        return view('pages.register', [
            'pageTitle' => '注册 · HelloTime Pro',
            'routeName' => 'register',
            'navKey' => 'me',
            'initData' => [
                'redirect' => $request->query('redirect'),
                'avatarIds' => array_column($this->avatars->all(), 'id'),
            ],
        ]);
    }

    public function logout(Request $request): RedirectResponse
    {
        $this->auth->logout((string) $request->cookies->get('ht_refresh', ''));
        return redirect('/')
            ->withCookie(cookie('ht_access', '', -2628000, '/', null, false, true, false, 'Lax'))
            ->withCookie(cookie('ht_refresh', '', -2628000, '/', null, false, true, false, 'Lax'));
    }
}
