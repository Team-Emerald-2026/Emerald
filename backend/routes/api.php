<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Response;

Route::get('/test', function () {
    return response()->json(
        ['message' => 'API動作確認OK'],
        Response::HTTP_OK,
        [],
        JSON_UNESCAPED_UNICODE
    );
});
