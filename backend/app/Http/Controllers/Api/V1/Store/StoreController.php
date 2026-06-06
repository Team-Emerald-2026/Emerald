<?php

namespace App\Http\Controllers\Api\V1\Store;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\Store;

class StoreController extends Controller
{
    public function index()
    {
        $stores = Store::query()
            ->select(['id', 'name', 'description', 'is_open', 'current_wait_min', 'current_queue_count'])
            ->orderBy('id')
            ->get();

        return StoreResource::collection($stores);
    }

    public function show(string $id)
    {
        $store = Store::find($id);

        if (!$store) {
            return response()->json([
                'errors' => [[
                    'status' => '404',
                    'title' => 'Not Found',
                    'detail' => '指定した飲食店が見つかりません',
                ]],
            ], 404, [], JSON_UNESCAPED_UNICODE);
        }

        return new StoreResource($store);
    }
}