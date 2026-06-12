<?php

use App\Http\Controllers\Web\AuthController;
use App\Http\Controllers\Web\CapsuleController;
use App\Http\Controllers\Web\PageController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'home']);
Route::get('/open', [PageController::class, 'open']);
Route::get('/about', [PageController::class, 'about']);

Route::get('/login', [AuthController::class, 'loginForm']);
Route::post('/login', [AuthController::class, 'login']);
Route::get('/register', [AuthController::class, 'registerForm']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/logout', [AuthController::class, 'logout']);

Route::get('/create', [PageController::class, 'create']);
Route::post('/create', [CapsuleController::class, 'store']);
Route::post('/me/capsules/{id}/delete', [CapsuleController::class, 'destroy']);

Route::get('/c/{code}', [PageController::class, 'capsule']);

Route::get('/me', [PageController::class, 'me']);
Route::get('/me/created', [PageController::class, 'created']);
Route::get('/me/favorites', [PageController::class, 'favorites']);
Route::get('/me/profile', [PageController::class, 'profile']);
