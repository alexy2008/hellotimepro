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
        return $this->api(fn () => $this->auth->register($this->body($request)), 201);
    }

    public function login(Request $request)
    {
        return $this->api(fn () => $this->auth->login($this->body($request)));
    }

    public function refresh(Request $request)
    {
        return $this->api(fn () => $this->auth->refresh((string) ($this->body($request)['refreshToken'] ?? '')));
    }

    public function logout(Request $request)
    {
        return $this->api(function () use ($request) {
            $this->auth->logout((string) ($this->body($request)['refreshToken'] ?? ''));
            return null;
        }, 204, true);
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
        return $this->api(function () use ($request) {
            $this->auth->changePassword($this->auth->requireUser($request), $this->body($request));
            return null;
        }, 204, true);
    }

    public function createCapsule(Request $request)
    {
        return $this->api(fn () => $this->capsules->createCapsule($this->auth->requireUser($request), $this->body($request)), 201);
    }

    public function capsuleByCode(Request $request, string $code)
    {
        $viewer = $this->auth->currentUser($request);
        return $this->api(fn () => $this->capsules->capsuleByCode($code, $viewer['id'] ?? null));
    }

    public function plaza(Request $request)
    {
        $viewer = $this->auth->currentUser($request);
        return $this->api(fn () => $this->plaza->plazaList($viewer['id'] ?? null, $request->query()));
    }

    public function plazaDetail(Request $request, string $id)
    {
        $viewer = $this->auth->currentUser($request);
        return $this->api(fn () => $this->plaza->plazaDetail($id, $viewer['id'] ?? null));
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
            if ($e->details) $payload['details'] = $e->details;
            return response()->json($payload, $e->status);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['success' => false, 'data' => null, 'message' => '服务器内部错误', 'errorCode' => 'INTERNAL_ERROR'], 500);
        }
    }

    private function body(Request $request): array
    {
        $raw = $request->getContent();
        if ($raw === '') return [];
        $data = json_decode($raw, true);
        if (!is_array($data)) throw new ApiError(400, 'BAD_REQUEST', 'JSON 请求体格式错误');
        return $data;
    }
}
