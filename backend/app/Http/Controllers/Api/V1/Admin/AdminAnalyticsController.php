<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\SalesEntry;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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

        $storeColumns = ['id', 'name', 'is_open'];
        if (Schema::hasColumn('stores', 'is_visible')) {
            $storeColumns[] = 'is_visible';
        }

        $stores = Store::query()
            ->orderBy('id')
            ->get($storeColumns)
            ->map(function (Store $store) use ($revenueRows) {
                $row = $revenueRows->get($store->id);

                return [
                    'store_id' => $store->id,
                    'store_name' => $store->name,
                    'is_open' => (bool) $store->is_open,
                    'is_visible' => (bool) ($store->is_visible ?? true),
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

        $salesRevenueByStore = collect();
        if (Schema::hasTable('sales_entries')) {
            $salesRevenueByStore = SalesEntry::query()
                ->select('store_id')
                ->selectRaw('SUM(amount) as revenue')
                ->groupBy('store_id')
                ->pluck('revenue', 'store_id');
        }

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

    /**
     * 売上データをすべてリセットする（元に戻せない）。
     * 会計（注文・明細）・売上入力・受付番号の採番を消し、各店舗の待ち人数を 0 に戻す。
     * 店舗・メニュー・ログインアカウント・マップ・イベントは消さない。
     */
    public function reset(Request $request)
    {
        $this->authorizeAdmin($request);

        $deleted = DB::transaction(function () {
            $orderCount = Order::query()->count();

            // 明細 → 注文の順で消す（order_items は orders に紐づく）
            OrderItem::query()->delete();
            Order::query()->delete();

            $salesEntryCount = 0;
            if (Schema::hasTable('sales_entries')) {
                $salesEntryCount = SalesEntry::query()->count();
                SalesEntry::query()->delete();
            }

            // 受付番号を 1 から振り直せるようにする
            if (Schema::hasTable('ticket_counters')) {
                DB::table('ticket_counters')->delete();
            }

            Store::query()->update(['current_queue_count' => 0]);

            return [
                'orders' => $orderCount,
                'sales_entries' => $salesEntryCount,
            ];
        });

        return response()->json(['data' => $deleted], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }
}
