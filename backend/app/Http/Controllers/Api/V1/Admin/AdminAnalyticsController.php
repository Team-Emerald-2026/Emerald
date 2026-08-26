<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Store;
use Illuminate\Http\Request;

class AdminAnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $totalRevenue = (int) Order::query()
            ->where('status', 'settled')
            ->sum('total_price');

        $totalOrders = (int) Order::query()->count();
        $settledOrders = (int) Order::query()->where('status', 'settled')->count();

        $revenueRows = Order::query()
            ->select('store_id')
            ->selectRaw('SUM(CASE WHEN status = ? THEN total_price ELSE 0 END) as revenue', ['settled'])
            ->selectRaw('COUNT(*) as order_count')
            ->groupBy('store_id')
            ->get()
            ->keyBy('store_id');

        $stores = Store::query()
            ->orderBy('id')
            ->get(['id', 'name', 'is_open', 'is_visible'])
            ->map(function (Store $store) use ($revenueRows) {
                $row = $revenueRows->get($store->id);

                return [
                    'store_id' => $store->id,
                    'store_name' => $store->name,
                    'is_open' => (bool) $store->is_open,
                    'is_visible' => (bool) $store->is_visible,
                    'revenue' => (int) ($row?->revenue ?? 0),
                    'order_count' => (int) ($row?->order_count ?? 0),
                ];
            })
            ->values();

        return response()->json([
            'data' => [
                'total_revenue' => $totalRevenue,
                'total_orders' => $totalOrders,
                'settled_orders' => $settledOrders,
                'stores' => $stores,
            ],
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }
}
