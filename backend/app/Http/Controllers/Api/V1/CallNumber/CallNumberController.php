<?php

namespace App\Http\Controllers\Api\V1\CallNumber;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class CallNumberController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'store_id' => ['nullable', 'string', 'max:64'],
        ]);

        $storeId = $validated['store_id'] ?? null;
        $cacheKey = 'api:v1:call-numbers:'.($storeId ?? 'all');

        // 全員が同じ一覧を見るため、短時間キャッシュしてDB負荷を抑える
        // （秒数は config/cache.php の api_list_ttl。0でキャッシュ無効）
        $data = Cache::remember($cacheKey, config('cache.api_list_ttl'), function () use ($storeId) {
            $orders = Order::query()
                ->currentlyCalled()
                ->with(['store:id,name,is_visible,is_open'])
                ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
                ->when(
                    Schema::hasColumn('stores', 'is_visible'),
                    fn ($query) => $query->whereHas('store', fn ($store) => $store->where('is_visible', true)),
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
