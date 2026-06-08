<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use App\Services\AvatarCatalog;
use App\Services\CapsuleService;
use App\Services\FavoriteService;
use App\Services\PlazaService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PageController extends Controller
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly PlazaService $plaza,
        private readonly CapsuleService $capsules,
        private readonly FavoriteService $favorites,
        private readonly AvatarCatalog $avatars,
    ) {
    }

    public function home(Request $request): View
    {
        $user = $this->auth->currentUser($request);
        $data = $this->plaza->plazaList($user['id'] ?? null, $request->query());
        return view('public.home', ['data' => $data, 'query' => $request->query()]);
    }

    public function open(): View
    {
        return view('public.open');
    }

    public function about(): View
    {
        return view('public.about', [
            'frontendStack' => [
                ['name' => 'Blade', 'version' => app()->version(), 'iconUrl' => '/static/icons/laravel.svg'],
                ['name' => 'Alpine.js', 'version' => '3', 'iconUrl' => '/static/icons/javascript.svg'],
                ['name' => 'Tailwind CSS', 'version' => '4', 'iconUrl' => '/static/icons/tailwindcss.svg'],
            ],
            'frontendSummary' => 'Laravel 版 UI 采用 Blade 模板直出 HTML，布局、表单、胶囊卡片与个人中心都在服务端渲染；Alpine.js 负责主题切换、用户菜单等轻量状态，原生脚本处理 AI 推荐、胶囊码输入、倒计时、收藏和资料页 fetch。样式复用 spec/styles 的 Tailwind v4 设计令牌与 cy-* 组件类，确保与其他前端/全栈实现视觉一致。',
        ]);
    }

    public function create(Request $request): View|RedirectResponse
    {
        if (!$this->auth->currentUser($request)) return redirect('/login?redirect=/create');
        return view('capsules.create');
    }

    public function capsule(Request $request, string $code): View
    {
        $user = $this->auth->currentUser($request);
        $capsule = $this->capsules->capsuleByCode($code, $user['id'] ?? null);
        return view('capsules.detail', ['capsule' => $capsule]);
    }

    public function plazaDetail(Request $request, string $id): View
    {
        $user = $this->auth->currentUser($request);
        $capsule = $this->plaza->plazaDetail($id, $user['id'] ?? null);
        return view('capsules.detail', ['capsule' => $capsule]);
    }

    public function me(Request $request): RedirectResponse
    {
        return redirect('/me/created');
    }

    public function created(Request $request): View|RedirectResponse
    {
        $user = $this->auth->currentUser($request);
        if (!$user) return redirect('/login?redirect=/me/created');
        return view('me.created', ['data' => $this->capsules->myCapsules($user, $request->query())]);
    }

    public function favorites(Request $request): View|RedirectResponse
    {
        $user = $this->auth->currentUser($request);
        if (!$user) return redirect('/login?redirect=/me/favorites');
        return view('me.favorites', ['data' => $this->favorites->myFavorites($user, $request->query())]);
    }

    public function profile(Request $request): View|RedirectResponse
    {
        $user = $this->auth->currentUser($request);
        if (!$user) return redirect('/login?redirect=/me/profile');
        return view('me.profile', ['user' => $user, 'avatars' => $this->avatars->all()]);
    }
}
