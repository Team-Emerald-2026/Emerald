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
        if (Schema::hasColumn('stores', 'wait_display_mode')) {
            $columns[] = 'wait_display_mode';
            $columns[] = 'wait_display_text';
        }

        $stores = Store::query()
            ->select($columns)
            ->when(Schema::hasColumn('stores', 'is_visible'), fn ($query) => $query->where('is_visible', true))
            ->with(['mapFacility:id,store_id'])
            ->orderBy('id')
            ->get();

        return StoreResource::collection($stores)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function show(string $id)
    {
        $store = Store::query()
            ->when(Schema::hasColumn('stores', 'is_visible'), fn ($query) => $query->where('is_visible', true))
            ->with([
                'menuItems' => fn ($query) => $query
                    ->where('is_available', true)
                    ->select(['id', 'store_id', 'name', 'description', 'price', 'is_available'])
                    ->orderBy('id'),
                'mapFacility:id,store_id,name,type,floor,x,y',
                'orders' => fn ($query) => $query
                    ->currentlyCalled()
                    ->select(['id', 'store_id', 'ticket_number', 'called_at'])
                    ->orderBy('called_at'),
            ])
            ->find($id);

        if (! $store) {
            return response()->json([
                'error' => [
                    'code' => 'NOT_FOUND',
                    'message' => '指定した飲食店が見つかりません',
                    'details' => ['field' => 'id'],
                ],
            ], 404, [], JSON_UNESCAPED_UNICODE);
        }

        return (new StoreResource($store))
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }
}
