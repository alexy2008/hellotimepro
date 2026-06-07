<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Services\HelloTimeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CapsuleController extends Controller
{
    public function __construct(private readonly HelloTimeService $hello)
    {
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->hello->currentUser($request);
        if (!$user) return redirect('/login?redirect=/create');

        try {
            $capsule = $this->hello->createCapsule($user, $request->only(['title', 'content', 'openAt', 'inPlaza']));
            return redirect('/c/' . $capsule['code']);
        } catch (ApiError $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function destroy(Request $request, string $id): RedirectResponse
    {
        $user = $this->hello->currentUser($request);
        if (!$user) return redirect('/login?redirect=/me/created');
        try {
            $this->hello->deleteCapsule($user, $id);
        } catch (ApiError) {
        }
        return redirect('/me/created');
    }
}
