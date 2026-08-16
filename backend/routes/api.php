<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Map\FacilityController;
use App\Http\Controllers\Api\V1\Store\StoreController;

use App\Http\Controllers\Api\V1\Booth\Dashboard\DashboardController;

use Illuminate\Http\Response;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\Booth\MenuItem\MenuItemController;

Route::get('/test', function () {
    return response()->json(
        ['message' => 'API動作確認OK'],
        Response::HTTP_OK,
        [],
        JSON_UNESCAPED_UNICODE
    );
});

Route::prefix('v1')->group(function () {
    Route::get('map/facilities', [FacilityController::class, 'index']);
    Route::get('restaurants', [StoreController::class, 'index']);
    Route::get('restaurants/{id}', [StoreController::class, 'show']);
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('auth/register', [AuthController::class, 'register']);

});

Route::prefix('v1/booth')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('dashboard', [DashboardController::class, 'index']);
    Route::patch('dashboard/{id}', [DashboardController::class, 'update']);
    Route::get('menu-items', [MenuItemController::class, 'index']);
    Route::post('menu-items', [MenuItemController::class, 'store']);
    Route::patch('menu-items/{id}', [MenuItemController::class, 'update']);
    Route::delete('menu-items/{id}', [MenuItemController::class, 'destroy']);
});

});
