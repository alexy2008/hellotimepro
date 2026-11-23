<?php

use App\Http\Controllers\Web\AuthController;
use App\Http\Controllers\Web\PageController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'home']);
Route::get('/open', [PageController::class, 'open']);
Route::get('/about', [PageController::class, 'about']);

Route::get('/login', [AuthController::class, 'loginForm']);
Route::get('/register', [AuthController::class, 'registerForm']);
Route::post('/logout', [AuthController::class, 'logout']);

Route::get('/create', [PageController::class, 'create']);

Route::get('/capsules/{code}', [PageController::class, 'capsule']);
Route::get('/c/{code}', fn (string $code) => redirect('/capsules/' . rawurlencode($code)));

Route::get('/me', fn () => redirect('/me/created'));
Route::get('/me/created', [PageController::class, 'created']);
Route::get('/me/favorites', [PageController::class, 'favorites']);
Route::get('/me/profile', [PageController::class, 'profile']);

Route::fallback([PageController::class, 'notFound']);
