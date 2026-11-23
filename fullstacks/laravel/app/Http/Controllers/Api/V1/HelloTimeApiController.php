<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Services\AuthService;
use App\Services\AvatarCatalog;
use App\Services\CapsuleService;
use App\Services\FavoriteService;
use App\Services\HealthService;
use App\Services\PlazaService;
use App\Services\ProfileService;
use App\Services\SuggestionService;
use Illuminate\Http\Request;
use Throwable;

/**
 * /api/v1 JSON 契约的统一入口：薄控制器，仅做请求解析、调度领域服务、包裹统一响应信封。
 * 鉴权端点在返回标准 JSON 的同时同步 httpOnly cookie，使浏览器通过 AJAX 登录 / 刷新 / 登出后，
 * 后续 SSR 页面导航也能立即识别同一登录态；纯 Bearer 契约调用不受影响。
 */
class HelloTimeApiController extends Controller
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly ProfileService $profiles,
        private readonly CapsuleService $capsules,
        private readonly PlazaService $plaza,
        private readonly FavoriteService $favorites,
        private readonly SuggestionService $suggestions,
        private readonly HealthService $health,
        private readonly AvatarCatalog $avatars,
    ) {
    }

    public function health()
    {
        return $this->api(fn () => $this->health->health());
    }

    public function avatars()
    {
        return $this->api(fn () => $this->avatars->all());
    }

    public function register(Request $request)
    {
        $tokens = null;
        $resp = $this->api(function () use ($request, &$tokens) {
            $tokens = $this->auth->register($this->body($request));
            return $tokens;
        }, 201);
        return $tokens ? $this->attachAuthCookies($resp, $tokens) : $resp;
    }

    public function login(Request $request)
    {
        $tokens = null;
        $resp = $this->api(function () use ($request, &$tokens) {
            $tokens = $this->auth->login($this->body($request));
            return $tokens;
        });
        return $tokens ? $this->attachAuthCookies($resp, $tokens) : $resp;
    }

    public function refresh(Request $request)
    {
        $tokens = null;
        $resp = $this->api(function () use ($request, &$tokens) {
            $body = $this->body($request);
            $refreshToken = array_key_exists('refreshToken', $body)
                ? (string) ($body['refreshToken'] ?? '')
                : (string) $request->cookies->get('ht_refresh', '');
            $tokens = $this->auth->refresh($refreshToken);
            return $tokens;
        });
        return $tokens ? $this->attachAuthCookies($resp, $tokens) : $resp;
    }

    public function logout(Request $request)
    {
        $resp = $this->api(function () use ($request) {
            $body = $this->body($request);
            $refreshToken = (string) ($body['refreshToken'] ?? '');
            if ($refreshToken === '' && $request->cookies->has('ht_refresh')) {
                $refreshToken = (string) $request->cookies->get('ht_refresh', '');
            }
            $this->auth->logout($refreshToken);
            return null;
        }, 204, true);

        return $resp->getStatusCode() === 204 ? $this->forgetAuthCookies($resp) : $resp;
    }

    public function me(Request $request)
    {
        return $this->api(fn () => $this->profiles->userDto($this->auth->requireUser($request)));
    }

    public function updateMe(Request $request)
    {
        return $this->api(fn () => $this->profiles->updateProfile($this->auth->requireUser($request), $this->body($request)));
    }

    public function changePassword(Request $request)
    {
        $resp = $this->api(function () use ($request) {
            $this->auth->changePassword($this->auth->requireUser($request), $this->body($request));
            return null;
        }, 204, true);

        return $resp->getStatusCode() === 204 ? $this->forgetAuthCookies($resp) : $resp;
    }

    public function myStats(Request $request)
    {
        return $this->api(fn () => $this->capsules->myStats($this->auth->requireUser($request)));
    }

    public function createCapsule(Request $request)
    {
        return $this->api(fn () => $this->capsules->createCapsule($this->auth->requireUser($request), $this->body($request)), 201);
    }

    public function capsuleByCode(Request $request, string $code)
    {
        $viewer = $this->auth->currentUser($request);
        return $this->api(fn () => $this->capsules->capsuleByCode($code, $viewer?->id));
    }

    public function plazaStats(Request $request)
    {
        return $this->api(fn () => $this->plaza->plazaStats($request->query()));
    }

    public function plaza(Request $request)
    {
        $viewer = $this->auth->currentUser($request);
        return $this->api(fn () => $this->plaza->plazaList($viewer?->id, $request->query()));
    }

    public function plazaDetail(Request $request, string $id)
    {
        $viewer = $this->auth->currentUser($request);
        return $this->api(fn () => $this->plaza->plazaDetail($id, $viewer?->id));
    }

    public function myCapsules(Request $request)
    {
        return $this->api(fn () => $this->capsules->myCapsules($this->auth->requireUser($request), $request->query()));
    }

    public function deleteCapsule(Request $request, string $id)
    {
        return $this->api(function () use ($request, $id) {
            $this->capsules->deleteCapsule($this->auth->requireUser($request), $id);
            return null;
        }, 204, true);
    }

    public function myFavorites(Request $request)
    {
        return $this->api(fn () => $this->favorites->myFavorites($this->auth->requireUser($request), $request->query()));
    }

    public function addFavorite(Request $request)
    {
        return $this->api(fn () => $this->favorites->addFavorite($this->auth->requireUser($request), (string) ($this->body($request)['capsuleId'] ?? '')));
    }

    public function removeFavorite(Request $request, string $id)
    {
        return $this->api(function () use ($request, $id) {
            $this->favorites->removeFavorite($this->auth->requireUser($request), $id);
            return null;
        }, 204, true);
    }

    public function suggestion(Request $request)
    {
        return $this->api(fn () => $this->suggestions->suggestion($this->body($request)));
    }

    public function recommendations(Request $request)
    {
        return $this->api(fn () => $this->suggestions->recommendations($request->query()));
    }

    private function api(callable $callback, int $status = 200, bool $empty = false)
    {
        try {
            $data = $callback();
            if ($empty) {
                return response()->noContent($status);
            }
            return response()->json(['success' => true, 'data' => $data, 'message' => null, 'errorCode' => null], $status);
        } catch (ApiError $e) {
            $payload = ['success' => false, 'data' => null, 'message' => $e->getMessage(), 'errorCode' => $e->errorCode];
            if ($e->details) {
                $payload['details'] = $e->details;
            }
            return response()->json($payload, $e->status);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['success' => false, 'data' => null, 'message' => '服务器内部错误', 'errorCode' => 'INTERNAL_ERROR'], 500);
        }
    }

    private function body(Request $request): array
    {
        $raw = $request->getContent();
        if ($raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new ApiError(400, 'BAD_REQUEST', 'JSON 请求体格式错误');
        }
        return $data;
    }

    private function attachAuthCookies($response, array $tokens)
    {
        return $response
            ->withCookie(cookie('ht_access', $tokens['accessToken'], 60, '/', null, false, true, false, 'Lax'))
            ->withCookie(cookie('ht_refresh', $tokens['refreshToken'], 60 * 24 * 7, '/', null, false, true, false, 'Lax'));
    }

    private function forgetAuthCookies($response)
    {
        return $response
            ->withCookie(cookie('ht_access', '', -2628000, '/', null, false, true, false, 'Lax'))
            ->withCookie(cookie('ht_refresh', '', -2628000, '/', null, false, true, false, 'Lax'));
    }
}
