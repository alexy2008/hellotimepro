<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Services\HelloTimeService;
use Illuminate\Http\Request;
use Throwable;

class HelloTimeApiController extends Controller
{
    public function __construct(private readonly HelloTimeService $hello)
    {
    }

    public function health()
    {
        return $this->api(fn () => $this->hello->health());
    }

    public function avatars()
    {
        return $this->api(fn () => $this->hello->avatars());
    }

    public function register(Request $request)
    {
        return $this->api(fn () => $this->hello->register($this->body($request)), 201);
    }

    public function login(Request $request)
    {
        return $this->api(fn () => $this->hello->login($this->body($request)));
    }

    public function refresh(Request $request)
    {
        return $this->api(fn () => $this->hello->refresh((string)($this->body($request)['refreshToken'] ?? '')));
    }

    public function logout(Request $request)
    {
        return $this->api(function () use ($request) {
            $this->hello->logout((string)($this->body($request)['refreshToken'] ?? ''));
            return null;
        }, 204, true);
    }

    public function me(Request $request)
    {
        return $this->api(fn () => $this->hello->userDto($this->hello->requireUser($request)));
    }

    public function updateMe(Request $request)
    {
        return $this->api(fn () => $this->hello->updateProfile($this->hello->requireUser($request), $this->body($request)));
    }

    public function changePassword(Request $request)
    {
        return $this->api(function () use ($request) {
            $this->hello->changePassword($this->hello->requireUser($request), $this->body($request));
            return null;
        }, 204, true);
    }

    public function createCapsule(Request $request)
    {
        return $this->api(fn () => $this->hello->createCapsule($this->hello->requireUser($request), $this->body($request)), 201);
    }

    public function capsuleByCode(Request $request, string $code)
    {
        $viewer = $this->hello->currentUser($request);
        return $this->api(fn () => $this->hello->capsuleByCode($code, $viewer['id'] ?? null));
    }

    public function plaza(Request $request)
    {
        $viewer = $this->hello->currentUser($request);
        return $this->api(fn () => $this->hello->plazaList($viewer['id'] ?? null, $request->query()));
    }

    public function plazaDetail(Request $request, string $id)
    {
        $viewer = $this->hello->currentUser($request);
        return $this->api(fn () => $this->hello->plazaDetail($id, $viewer['id'] ?? null));
    }

    public function myCapsules(Request $request)
    {
        return $this->api(fn () => $this->hello->myCapsules($this->hello->requireUser($request), $request->query()));
    }

    public function deleteCapsule(Request $request, string $id)
    {
        return $this->api(function () use ($request, $id) {
            $this->hello->deleteCapsule($this->hello->requireUser($request), $id);
            return null;
        }, 204, true);
    }

    public function myFavorites(Request $request)
    {
        return $this->api(fn () => $this->hello->myFavorites($this->hello->requireUser($request), $request->query()));
    }

    public function addFavorite(Request $request)
    {
        return $this->api(fn () => $this->hello->addFavorite($this->hello->requireUser($request), (string)($this->body($request)['capsuleId'] ?? '')));
    }

    public function removeFavorite(Request $request, string $id)
    {
        return $this->api(function () use ($request, $id) {
            $this->hello->removeFavorite($this->hello->requireUser($request), $id);
            return null;
        }, 204, true);
    }

    public function suggestion(Request $request)
    {
        return $this->api(fn () => $this->hello->suggestion($this->body($request)));
    }

    public function recommendations(Request $request)
    {
        return $this->api(fn () => $this->hello->recommendations($request->query()));
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
