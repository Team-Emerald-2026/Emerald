<?php

namespace App\Http\Controllers\Api\V1\CallNumber;

use App\Http\Controllers\Controller;
use App\Models\FestivalSetting;
use App\Models\Order;
use App\Support\DbSchema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CallNumberController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'store_id' => ['nullable', 'string', 'max:64'],
        ]);

        $storeId = $validated['store_id'] ?? null;
        $currentDay = FestivalSetting::currentDay();
        $cacheKey = 'api:v1:call-numbers:'.($storeId ?? 'all').':'.$currentDay;

        // 全員が同じ一覧を見るため、短時間キャッシュしてDB負荷を抑える
        // （秒数は config/cache.php の api_list_ttl。0でキャッシュ無効）
        $data = Cache::remember($cacheKey, config('cache.api_list_ttl'), function () use ($storeId, $currentDay) {
            $storeColumns = ['id', 'name', 'is_visible', 'is_open'];
            if (DbSchema::hasColumn('stores', 'exhibition_day')) {
                $storeColumns[] = 'exhibition_day';
            }

            $orders = Order::query()
                ->currentlyCalled()
                ->with(['store:'.implode(',', $storeColumns)])
                ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
                ->when(
                    DbSchema::hasColumn('stores', 'is_visible'),
                    fn ($query) => $query->whereHas('store', fn ($store) => $store->where('is_visible', true)),
                )
                ->when(
                    DbSchema::hasColumn('stores', 'exhibition_day'),
                    fn ($query) => $query->whereHas(
                        'store',
                        fn ($store) => $store->forCurrentFestivalDay($currentDay),
                    ),
                )
                ->orderBy('called_at')
                ->get();

            return $orders->map(fn (Order $order) => [
                'id' => (string) $order->id,
                'store_id' => $order->store_id,
                'store_name' => $order->store?->name,
                'ticket_number' => $order->ticket_number,
                'called_at' => optional($order->called_at)->toISOString(),
            ])->values()->all();
        });

        return response()->json(['data' => $data], 200, [], JSON_UNESCAPED_UNICODE);
    }
}
