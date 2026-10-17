<?php

namespace App\Http\Controllers\Api\V1\Store;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\FestivalSetting;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class StoreController extends Controller
{
    public function index(Request $request)
    {
        Store::ensureCrowdLevelColumn();

        $validated = $request->validate([
            'day' => ['nullable', 'string', Rule::in(FestivalSetting::allowedDays())],
        ]);

        $adminCurrentDay = FestivalSetting::currentDay();
        $filterDay = $validated['day'] ?? $adminCurrentDay;

        // 全員が同じ一覧を見るため、短時間キャッシュしてDB負荷を抑える
        // （秒数は config/cache.php の api_list_ttl。0でキャッシュ無効）
        $payload = Cache::remember('api:v1:restaurants:index:'.$filterDay, config('cache.api_list_ttl'), function () use ($filterDay) {
            $columns = ['id', 'name', 'description', 'is_open', 'current_wait_min', 'current_queue_count'];
            if (Schema::hasColumn('stores', 'is_visible')) {
                $columns[] = 'is_visible';
            }
            if (Schema::hasColumn('stores', 'exhibition_day')) {
                $columns[] = 'exhibition_day';
            }
            if (Schema::hasColumn('stores', 'wait_display_mode')) {
                $columns[] = 'wait_display_mode';
                $columns[] = 'wait_display_text';
            }
            if (Store::hasCrowdLevelColumn()) {
                $columns[] = 'crowd_level';
            }

            $stores = Store::query()
                ->select($columns)
                ->when(Schema::hasColumn('stores', 'is_visible'), fn ($query) => $query->where('is_visible', true))
                ->forCurrentFestivalDay($filterDay)
                ->with(['mapFacility:id,store_id'])
                ->orderBy('id')
                ->get();

            return StoreResource::collection($stores)->resolve();
        });

        return response()->json([
            'data' => $payload,
            'meta' => [
                'current_day' => $adminCurrentDay,
                'filter_day' => $filterDay,
            ],
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public function show(Request $request, string $id)
    {
        Store::ensureCrowdLevelColumn();

        $validated = $request->validate([
            'day' => ['nullable', 'string', Rule::in(FestivalSetting::allowedDays())],
        ]);
        $filterDay = $validated['day'] ?? null;

        $store = Store::query()
            ->when(Schema::hasColumn('stores', 'is_visible'), fn ($query) => $query->where('is_visible', true))
            // day 指定時はその日の出展ブース詳細を見られる。未指定なら今日の学園祭日で絞る
            ->when(
                Schema::hasColumn('stores', 'exhibition_day'),
                fn ($query) => $query->forCurrentFestivalDay($filterDay),
            )
            ->with([
                'menuItems' => fn ($query) => $query
                    ->where('is_available', true)
                    ->select(['id', 'store_id', 'name', 'description', 'price', 'is_available', 'is_sold_out'])
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
