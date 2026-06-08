<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Services\AuthService;
use App\Services\CapsuleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CapsuleController extends Controller
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly CapsuleService $capsules,
    ) {
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->auth->currentUser($request);
        if (!$user) return redirect('/login?redirect=/create');

        try {
            $capsule = $this->capsules->createCapsule($user, $request->only(['title', 'content', 'openAt', 'inPlaza']));
            return redirect('/c/' . $capsule['code']);
        } catch (ApiError $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function destroy(Request $request, string $id): RedirectResponse
    {
        $user = $this->auth->currentUser($request);
        if (!$user) return redirect('/login?redirect=/me/created');
        try {
            $this->capsules->deleteCapsule($user, $id);
        } catch (ApiError) {
        }
        return redirect('/me/created');
    }
}
