<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\SalesEntry;
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

    public function revenue(Request $request)
    {
        $this->authorizeAdmin($request);

        $orderRevenueByStore = Order::query()
            ->select('store_id')
            ->selectRaw('SUM(CASE WHEN status = ? THEN total_price ELSE 0 END) as revenue', ['settled'])
            ->groupBy('store_id')
            ->pluck('revenue', 'store_id');

        $salesRevenueByStore = SalesEntry::query()
            ->select('store_id')
            ->selectRaw('SUM(amount) as revenue')
            ->groupBy('store_id')
            ->pluck('revenue', 'store_id');

        $stores = Store::query()
            ->orderBy('id')
            ->get(['id', 'name'])
            ->map(function (Store $store) use ($orderRevenueByStore, $salesRevenueByStore) {
                $orderRevenue = (int) ($orderRevenueByStore->get($store->id) ?? 0);
                $salesRevenue = (int) ($salesRevenueByStore->get($store->id) ?? 0);

                return [
                    'store_id' => $store->id,
                    'store_name' => $store->name,
                    'order_revenue' => $orderRevenue,
                    'sales_entry_revenue' => $salesRevenue,
                    'revenue' => $orderRevenue + $salesRevenue,
                ];
            })
            ->values();

        return response()->json([
            'data' => [
                'total_revenue' => (int) $stores->sum('revenue'),
                'order_revenue' => (int) $stores->sum('order_revenue'),
                'sales_entry_revenue' => (int) $stores->sum('sales_entry_revenue'),
                'stores' => $stores,
            ],
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }
}
