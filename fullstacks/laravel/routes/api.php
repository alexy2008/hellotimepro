<?php

use App\Http\Controllers\Api\V1\HelloTimeApiController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->controller(HelloTimeApiController::class)->group(function () {
    Route::get('/health', 'health');
    Route::get('/avatars', 'avatars');

    Route::post('/auth/register', 'register');
    Route::post('/auth/login', 'login');
    Route::post('/auth/refresh', 'refresh');
    Route::post('/auth/logout', 'logout');

    Route::get('/me', 'me');
    Route::patch('/me', 'updateMe');
    Route::post('/me/password', 'changePassword');
    Route::get('/me/capsules', 'myCapsules');
    Route::delete('/me/capsules/{id}', 'deleteCapsule');
    Route::get('/me/favorites', 'myFavorites');
    Route::post('/me/favorites', 'addFavorite');
    Route::delete('/me/favorites/{id}', 'removeFavorite');

    Route::post('/capsules', 'createCapsule');
    Route::get('/capsules/{code}', 'capsuleByCode');
    Route::get('/plaza/capsules', 'plaza');
    Route::get('/plaza/capsules/{id}', 'plazaDetail');

    Route::post('/capsule-suggestion', 'suggestion');
    Route::get('/capsule-recommendations', 'recommendations');
});
