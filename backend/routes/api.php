<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Admin\AdminAuthController;
use App\Http\Controllers\Api\V1\Admin\AdminAnalyticsController;
use App\Http\Controllers\Api\V1\Admin\AdminStoreController;
use App\Http\Controllers\Api\V1\Map\FacilityController;
use App\Http\Controllers\Api\V1\Store\StoreController;

use App\Http\Controllers\Api\V1\Booth\Accounting\AccountingController;
use App\Http\Controllers\Api\V1\Booth\Dashboard\DashboardController;

use Illuminate\Http\Response;
use Illuminate\Support\Facades\Route;

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
        Route::get('accounting/menu-items', [AccountingController::class, 'menuItems']);
        Route::get('accounting/orders', [AccountingController::class, 'index']);
        Route::get('accounting/orders/ticket/{ticketNumber}', [AccountingController::class, 'showByTicket']);
        Route::get('accounting/orders/{id}', [AccountingController::class, 'show'])->whereNumber('id');
        Route::post('accounting/orders', [AccountingController::class, 'store']);
        Route::patch('accounting/orders/{id}/settle', [AccountingController::class, 'settle'])->whereNumber('id');
        Route::patch('dashboard/{id}', [DashboardController::class, 'update']);
    });

});

Route::prefix('v1/admin')->group(function () {
    Route::post('auth/login', [AdminAuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AdminAuthController::class, 'logout']);
        Route::get('analytics', [AdminAnalyticsController::class, 'index']);
        Route::get('stores', [AdminStoreController::class, 'index']);
        Route::post('stores', [AdminStoreController::class, 'store']);
        Route::patch('stores/{id}', [AdminStoreController::class, 'update']);
        Route::delete('stores/{id}', [AdminStoreController::class, 'destroy']);
    });
});
