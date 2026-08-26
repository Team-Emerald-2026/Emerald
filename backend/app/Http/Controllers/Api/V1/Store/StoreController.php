<?php

namespace App\Http\Controllers\Api\V1\Store;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use Illuminate\Support\Facades\Schema;

class StoreController extends Controller
{
    public function index()
    {
        $columns = ['id', 'name', 'description', 'is_open', 'current_wait_min', 'current_queue_count'];
        if (Schema::hasColumn('stores', 'is_visible')) {
            $columns[] = 'is_visible';
        }

        $stores = Store::query()
            ->select($columns)
            ->when(Schema::hasColumn('stores', 'is_visible'), fn ($query) => $query->where('is_visible', true))
            ->orderBy('id')
            ->get();

        return StoreResource::collection($stores);
    }

    public function show(string $id)
    {
        $store = Store::query()
            ->when(Schema::hasColumn('stores', 'is_visible'), fn ($query) => $query->where('is_visible', true))
            ->find($id);

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