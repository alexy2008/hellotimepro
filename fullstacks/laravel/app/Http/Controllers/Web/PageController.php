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
use App\Support\Mapper;
use App\Support\UiHelper;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\View;
use Throwable;

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

        $query = $this->plazaQuery($request->query());
        $list = $this->plaza->plazaList($viewerId, $query + ['pageSize' => 9]);
        $overview = $this->plaza->plazaStats([]);
        $counts = $query['q'] === '' ? $overview['counts'] : $this->plaza->plazaStats($query)['counts'];
        $featuredList = $this->plaza->plazaList($viewerId, ['sort' => 'hot', 'filter' => 'unopened', 'page' => 1, 'pageSize' => 1]);

        return view('pages.home', [
            'pageTitle' => 'HelloTime Pro · 把此刻寄给未来',
            'routeName' => 'plaza',
            'navKey' => 'plaza',
            'initData' => [
                'query' => $query,
                'items' => $list['items'],
                'pagination' => $list['pagination'],
                'counts' => $counts,
                'overview' => $overview,
                'featured' => $featuredList['items'][0] ?? null,
            ],
        ]);
    }

    private function plazaQuery(array $input): array
    {
        $sort = $input['sort'] ?? null;
        $filter = $input['filter'] ?? null;
        $q = $input['q'] ?? null;
        $page = Mapper::positiveInteger($input['page'] ?? null);

        return [
            'sort' => $sort === 'hot' ? 'hot' : 'new',
            'filter' => in_array($filter, ['opened', 'unopened'], true) ? $filter : 'all',
            'q' => is_string($q) ? mb_substr(trim($q), 0, 50, 'UTF-8') : '',
            'page' => $page !== null && $page - 1 <= intdiv(PHP_INT_MAX, 9) ? $page : 1,
        ];
    }

    private function plazaReturnUrl(Request $request): string
    {
        $referer = parse_url($request->headers->get('referer', ''));
        if (!is_array($referer)
            || ($referer['host'] ?? null) !== $request->getHost()
            || ($referer['path'] ?? '/') !== '/'
            || empty($referer['query'])) {
            return '/';
        }

        parse_str($referer['query'], $input);
        return '/?' . http_build_query($this->plazaQuery($input), encoding_type: PHP_QUERY_RFC3986);
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
        $normalized = strtoupper($code);
        $capsule = null;
        $status = 'ok';
        $httpCode = 200;

        try {
            $user = $this->auth->currentUser($request);
            $capsule = $this->capsules->capsuleByCode($normalized, $user?->id);
        } catch (ApiError $e) {
            if ($e->status === 404 || $e->status === 422) {
                $status = 'missing';
                $httpCode = 404;
            } else {
                $status = 'error';
                $httpCode = 500;
            }
        } catch (Throwable $e) {
            report($e);
            $status = 'error';
            $httpCode = 500;
        }

        $title = match ($status) {
            'ok' => $capsule['title'],
            'missing' => '查无此信',
            default => '暂时无法加载胶囊',
        };

        $plazaReturnUrl = $this->plazaReturnUrl($request);

        return response()->view('pages.detail', [
            'pageTitle' => $title . ' · HelloTime Pro',
            'routeName' => 'capsule',
            'navKey' => 'open',
            'plazaReturnUrl' => $plazaReturnUrl,
            'initData' => [
                'code' => $normalized,
                'capsule' => $capsule,
                'status' => $status,
                'plazaReturnUrl' => $plazaReturnUrl,
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
            'uiSummary' => '基于 Laravel Blade 模板与 Alpine.js 3 构建界面层，首屏由服务端直出完整数据并将页面拆分为「时笺」与「琥珀」两套 2.0 皮肤视图。首帧前内联脚本从本地存储同步皮肤与明暗属性，防止页面闪烁；Alpine.js 以轻量响应式指令承载无刷新换肤、星轨时钟、对数时间标尺、长按封缄、倒计时自动开启与异步表单校验。样式原样引入 spec/styles 2.0 设计令牌与自托管字体，不依赖 Tailwind 或前端打包构建链。',
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
