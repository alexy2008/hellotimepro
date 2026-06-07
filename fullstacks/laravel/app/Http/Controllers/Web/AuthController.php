<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Services\HelloTimeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function __construct(private readonly HelloTimeService $hello)
    {
    }

    public function loginForm(Request $request): View|RedirectResponse
    {
        if ($this->hello->currentUser($request)) return redirect('/');
        return view('auth.login');
    }

    public function registerForm(Request $request): View|RedirectResponse
    {
        if ($this->hello->currentUser($request)) return redirect('/');
        return view('auth.register', ['avatars' => $this->hello->avatars()]);
    }

    public function login(Request $request): RedirectResponse
    {
        try {
            $tokens = $this->hello->login($request->only(['email', 'password']));
            return redirect($this->safeRedirect((string)$request->query('redirect', '/me/created')))
                ->withCookies($this->authCookies($tokens['accessToken'], $tokens['refreshToken']));
        } catch (ApiError $e) {
            return back()->withInput($request->only('email'))->with('error', $e->getMessage());
        }
    }

    public function register(Request $request): RedirectResponse
    {
        try {
            $tokens = $this->hello->register($request->only(['email', 'password', 'nickname', 'avatarId']));
            return redirect('/create')->withCookies($this->authCookies($tokens['accessToken'], $tokens['refreshToken']));
        } catch (ApiError $e) {
            return back()->withInput($request->except('password'))->with('error', $e->getMessage());
        }
    }

    public function logout(Request $request): RedirectResponse
    {
        $this->hello->logout((string)$request->cookies->get('ht_refresh', ''));
        return redirect('/login')->withCookie(cookie()->forget('ht_access'))->withCookie(cookie()->forget('ht_refresh'));
    }

    private function authCookies(string $access, string $refresh): array
    {
        return [
            cookie('ht_access', $access, 60, '/', null, false, true, false, 'Lax'),
            cookie('ht_refresh', $refresh, 60 * 24 * 7, '/', null, false, true, false, 'Lax'),
        ];
    }

    private function safeRedirect(string $path): string
    {
        if ($path === '' || !str_starts_with($path, '/') || str_starts_with($path, '//') || preg_match('#^[a-z]+:#i', $path)) {
            return '/me/created';
        }
        return $path;
    }
}
