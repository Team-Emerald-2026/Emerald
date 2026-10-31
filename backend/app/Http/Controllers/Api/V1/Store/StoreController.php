<?php

namespace App\Http\Controllers\Api\V1\Store;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\FestivalSetting;
use App\Models\Store;
use App\Support\BoothSchedule;
use App\Support\DbSchema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

class StoreController extends Controller
{
    public function index(Request $request)
    {
        Store::ensureCrowdLevelColumn();
        Store::ensureShowOnCallPageColumn();

        $validated = $request->validate([
            'day' => ['nullable', 'string', Rule::in(FestivalSetting::allowedDays())],
        ]);

        $adminCurrentDay = FestivalSetting::currentDay();
        $filterDay = $validated['day'] ?? $adminCurrentDay;

        // 全員が同じ一覧を見るため、短時間キャッシュしてDB負荷を抑える
        // （秒数は config/cache.php の api_list_ttl。0でキャッシュ無効）
        $payload = Cache::remember('api:v1:restaurants:index:'.$filterDay, config('cache.api_list_ttl'), function () use ($filterDay) {
            $columns = ['id', 'name', 'description', 'is_open', 'current_wait_min', 'current_queue_count'];
            if (DbSchema::hasColumn('stores', 'is_visible')) {
                $columns[] = 'is_visible';
            }
            if (DbSchema::hasColumn('stores', 'exhibition_day')) {
                $columns[] = 'exhibition_day';
            }
            if (DbSchema::hasColumn('stores', 'wait_display_mode')) {
                $columns[] = 'wait_display_mode';
                $columns[] = 'wait_display_text';
            }
            if (Store::hasCrowdLevelColumn()) {
                $columns[] = 'crowd_level';
            }
            if (Store::hasShowOnCallPageColumn()) {
                $columns[] = 'show_on_call_page';
            }
            if (DbSchema::hasColumn('stores', 'time_slots')) {
                $columns[] = 'time_slots';
            }

            $stores = Store::query()
                ->select($columns)
                ->when(DbSchema::hasColumn('stores', 'is_visible'), fn ($query) => $query->where('is_visible', true))
                ->forCurrentFestivalDay($filterDay)
                ->with(['mapFacility:id,store_id,type,floor'])
                ->orderBy('id')
                ->get()
                // 出展時間がある店舗は、その日に時間帯があるときだけ出す
                ->filter(fn (Store $store) => empty($store->time_slots)
                    || BoothSchedule::slotsForDay($store->time_slots, $filterDay) !== [])
                ->values();

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
        $store = Store::query()
            ->when(Schema::hasColumn('stores', 'is_visible'), fn ($query) => $query->where('is_visible', true))
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
            ->findOrFail($id);

        return response()->json(['data' => $payload], 200, [], JSON_UNESCAPED_UNICODE);
    }
}
