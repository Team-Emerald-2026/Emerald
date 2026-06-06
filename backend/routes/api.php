<?php

use App\Http\Controllers\Api\V1\Map\FacilityController;
use App\Http\Controllers\Api\V1\Store\StoreController;
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
});