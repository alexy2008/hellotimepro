<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Services\AuthService;
use App\Services\AvatarCatalog;
use App\Services\CapsuleService;
use App\Services\FavoriteService;
use App\Services\HealthService;
use App\Services\PlazaService;
use App\Support\UiHelper;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\View;

/**
 * Web 页面控制器（2.0）：使用 Eloquent 服务层直出首屏数据给 Blade 模板，
 * 并在服务端执行受保护路由守卫（/create、/me/* 未登录直接 302 跳转 /login?redirect=...）。
 */
class PageController extends Controller
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly PlazaService $plaza,
        private readonly CapsuleService $capsules,
        private readonly FavoriteService $favorites,
        private readonly AvatarCatalog $avatars,
        private readonly HealthService $health,
    ) {
    }

    public function home(Request $request): View
    {
        $user = $this->auth->currentUser($request);
        $viewerId = $user?->id;

        $list = $this->plaza->plazaList($viewerId, ['sort' => 'new', 'filter' => 'all', 'page' => 1, 'pageSize' => 9]);
        $overview = $this->plaza->plazaStats([]);
        $featuredList = $this->plaza->plazaList($viewerId, ['sort' => 'hot', 'filter' => 'unopened', 'page' => 1, 'pageSize' => 1]);

        return view('pages.home', [
            'pageTitle' => 'HelloTime Pro · 把此刻寄给未来',
            'routeName' => 'plaza',
            'navKey' => 'plaza',
            'initData' => [
                'items' => $list['items'],
                'pagination' => $list['pagination'],
                'counts' => $overview['counts'],
                'overview' => $overview,
                'featured' => $featuredList['items'][0] ?? null,
            ],
        ]);
    }

    public function open(Request $request): View
    {
        $user = $this->auth->currentUser($request);
        $mine = $user ? $this->capsules->myCapsules($user, ['page' => 1, 'pageSize' => 3])['items'] : [];

        return view('pages.open', [
            'pageTitle' => '开启胶囊 · HelloTime Pro',
            'routeName' => 'open',
            'navKey' => 'open',
            'initData' => [
                'mySealed' => $mine,
            ],
        ]);
    }

    public function capsule(Request $request, string $code): Response
    {
        $user = $this->auth->currentUser($request);
        $normalized = strtoupper($code);
        $capsule = null;
        $status = 'ok';
        $httpCode = 200;

        try {
            $capsule = $this->capsules->capsuleByCode($normalized, $user?->id);
        } catch (ApiError $e) {
            if ($e->status === 404 || $e->status === 422) {
                $status = 'missing';
                $httpCode = 404;
            } else {
                $status = 'error';
                $httpCode = 500;
            }
        }

        $title = $capsule ? ($capsule['title'] . ' · HelloTime Pro') : '查无此信 · HelloTime Pro';

        return response()->view('pages.detail', [
            'pageTitle' => $title,
            'routeName' => 'capsule',
            'navKey' => 'open',
            'initData' => [
                'code' => $normalized,
                'capsule' => $capsule,
                'status' => $status,
            ],
        ], $httpCode);
    }

    public function create(Request $request): View|RedirectResponse
    {
        if (!$this->auth->currentUser($request)) {
            return redirect(UiHelper::loginRedirectUrl('/create'));
        }

        return view('pages.create', [
            'pageTitle' => '写一枚胶囊 · HelloTime Pro',
            'routeName' => 'create',
            'navKey' => 'create',
            'initData' => [],
        ]);
    }

    public function created(Request $request): View|RedirectResponse
    {
        return $this->mePage($request, 'created');
    }

    public function favorites(Request $request): View|RedirectResponse
    {
        return $this->mePage($request, 'favorites');
    }

    public function profile(Request $request): View|RedirectResponse
    {
        return $this->mePage($request, 'profile');
    }

    private function mePage(Request $request, string $tab): View|RedirectResponse
    {
        $user = $this->auth->currentUser($request);
        if (!$user) {
            return redirect(UiHelper::loginRedirectUrl('/me/' . $tab));
        }

        $stats = $this->capsules->myStats($user);
        $list = match ($tab) {
            'created' => $this->capsules->myCapsules($user, ['page' => 1, 'pageSize' => 20]),
            'favorites' => $this->favorites->myFavorites($user, ['page' => 1, 'pageSize' => 20]),
            default => null,
        };

        $titles = [
            'created' => '我创建的 · HelloTime Pro',
            'favorites' => '我收藏的 · HelloTime Pro',
            'profile' => '账号设置 · HelloTime Pro',
        ];

        return view('pages.me', [
            'pageTitle' => $titles[$tab],
            'routeName' => 'me',
            'navKey' => 'me',
            'initData' => [
                'tab' => $tab,
                'stats' => $stats,
                'items' => $list ? $list['items'] : [],
                'total' => $list ? $list['pagination']['total'] : 0,
                'avatarIds' => array_column($this->avatars->all(), 'id'),
            ],
        ]);
    }

    public function about(): View
    {
        $healthData = $this->health->health();
        $allItems = $healthData['stack']['items'];
        $uiRoles = ['template', 'enhancement'];
        $uiItems = array_values(array_filter($allItems, fn ($i) => in_array($i['role'], $uiRoles, true)));
        $serverItems = array_values(array_filter($allItems, fn ($i) => !in_array($i['role'], $uiRoles, true)));

        return view('pages.about', [
            'pageTitle' => '关于 · HelloTime Pro',
            'routeName' => 'about',
            'navKey' => 'about',
            'uiStack' => $uiItems,
            'serverStack' => $serverItems,
            'uiSummary' => 'Blade 模板将页面拆分为「时笺」「琥珀」两套皮肤视图，并在服务端直出首屏数据；Alpine.js 负责无刷新换肤、星轨时钟、时间标尺、长按封缄、倒计时自动开启与表单校验，样式原样引入 spec/styles 2.0 设计令牌，不使用 Tailwind。',
            'serverSummary' => $healthData['stack']['summary'],
            'features' => UiHelper::FEATURES,
            'tenets' => UiHelper::TENETS,
            'roleLabels' => UiHelper::ROLE_LABELS,
            'techNotes' => UiHelper::TECH_NOTES,
        ]);
    }

    public function notFound(): Response
    {
        return response()->view('pages.not-found', [
            'pageTitle' => '查无此页 · HelloTime Pro',
            'routeName' => 'not-found',
            'navKey' => '',
        ], 404);
    }
}
