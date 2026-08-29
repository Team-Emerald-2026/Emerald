<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Admin\AdminAuthController;
use App\Http\Controllers\Api\V1\Admin\AdminAnalyticsController;
use App\Http\Controllers\Api\V1\Admin\AdminEventController;
use App\Http\Controllers\Api\V1\Admin\AdminStoreController;
use App\Http\Controllers\Api\V1\CallNumber\CallNumberController;
use App\Http\Controllers\Api\V1\Event\EventController;
use App\Http\Controllers\Api\V1\Map\FacilityController;
use App\Http\Controllers\Api\V1\Monitor\MonitorCallNumberController;
use App\Http\Controllers\Api\V1\Store\StoreController;
use App\Http\Controllers\Api\V1\Store\WaitTimeController;

use App\Http\Controllers\Api\V1\Booth\Accounting\AccountingController;
use App\Http\Controllers\Api\V1\Booth\Dashboard\DashboardController;
use App\Http\Controllers\Api\V1\Booth\Sales\SalesController;

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
    Route::get('call-numbers', [CallNumberController::class, 'index']);
    Route::get('monitor/call-numbers', [MonitorCallNumberController::class, 'index']);
    Route::get('events', [EventController::class, 'index']);
    Route::get('events/{id}', [EventController::class, 'show']);
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('auth/register', [AuthController::class, 'register']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::patch('store/{id}/wait-time', [WaitTimeController::class, 'update']);
    });
});

Route::prefix('v1/booth')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('dashboard', [DashboardController::class, 'index']);
        Route::get('accounting/menu-items', [AccountingController::class, 'menuItems']);
        Route::post('accounting/menu-items', [AccountingController::class, 'storeMenuItem']);
        Route::patch('accounting/menu-items/{id}', [AccountingController::class, 'updateMenuItem'])->whereNumber('id');
        Route::delete('accounting/menu-items/{id}', [AccountingController::class, 'destroyMenuItem'])->whereNumber('id');
        Route::get('accounting/orders', [AccountingController::class, 'index']);
        Route::get('accounting/orders/ticket/{ticketNumber}', [AccountingController::class, 'showByTicket']);
        Route::get('accounting/orders/{id}', [AccountingController::class, 'show'])->whereNumber('id');
        Route::post('accounting/orders', [AccountingController::class, 'store']);
        Route::patch('accounting/orders/{id}/settle', [AccountingController::class, 'settle'])->whereNumber('id');
        Route::patch('accounting/orders/{id}/call', [AccountingController::class, 'call'])->whereNumber('id');
        Route::patch('accounting/orders/{id}/serve', [AccountingController::class, 'serve'])->whereNumber('id');
        Route::patch('dashboard/{id}', [DashboardController::class, 'update']);
        Route::get('sales', [SalesController::class, 'index']);
        Route::post('sales', [SalesController::class, 'store']);
        Route::patch('sales/{id}', [SalesController::class, 'update'])->whereNumber('id');
        Route::delete('sales/{id}', [SalesController::class, 'destroy'])->whereNumber('id');
    });
});

Route::prefix('v1/admin')->group(function () {
    Route::post('auth/login', [AdminAuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AdminAuthController::class, 'logout']);
        Route::get('analytics', [AdminAnalyticsController::class, 'index']);
        Route::get('revenue', [AdminAnalyticsController::class, 'revenue']);
        Route::get('stores', [AdminStoreController::class, 'index']);
        Route::post('stores', [AdminStoreController::class, 'store']);
        Route::get('stores/{id}', [AdminStoreController::class, 'show']);
        Route::patch('stores/{id}', [AdminStoreController::class, 'update']);
        Route::delete('stores/{id}', [AdminStoreController::class, 'destroy']);
        Route::get('events', [AdminEventController::class, 'index']);
        Route::post('events', [AdminEventController::class, 'store']);
        Route::get('events/{id}', [AdminEventController::class, 'show']);
        Route::patch('events/{id}', [AdminEventController::class, 'update']);
        Route::delete('events/{id}', [AdminEventController::class, 'destroy']);
    });
});
