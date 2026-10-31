<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\SalesEntry;
use App\Models\Store;
use App\Support\DbSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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
        if (DbSchema::hasColumn('stores', 'is_visible')) {
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

    /**
     * ブースの精算済み会計を、開催日ごとに店舗の金額順で返す。
     * 客単価は精算済みの金額 ÷ 精算済み件数（円未満は四捨五入）。
     */
    public function booth(Request $request)
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'day' => ['sometimes', 'string', Rule::in(['day1', 'day2', 'all'])],
        ]);
        $day = $validated['day'] ?? 'all';

        $rows = $this->settledRows($day);
        $names = Store::query()
            ->whereIn('id', $rows->pluck('store_id'))
            ->pluck('name', 'id');

        $stores = $rows
            ->map(function ($row) use ($names) {
                $revenue = (int) $row->revenue;
                $count = (int) $row->settled_orders;

                return [
                    'store_id' => (string) $row->store_id,
                    'store_name' => (string) ($names->get($row->store_id) ?? $row->store_id),
                    'revenue' => $revenue,
                    'settled_orders' => $count,
                    'average_ticket' => $this->averageTicket($revenue, $count),
                ];
            })
            ->sort(function (array $left, array $right) {
                if ($left['revenue'] !== $right['revenue']) {
                    return $right['revenue'] <=> $left['revenue'];
                }

                return strcmp($left['store_name'], $right['store_name']);
            })
            ->values();

        $totalRevenue = (int) $stores->sum('revenue');
        $settledOrders = (int) $stores->sum('settled_orders');
        $operations = $this->boothOperations($day);

        return response()->json([
            'data' => [
                'day' => $day,
                'generated_at' => now('Asia/Tokyo')->format('Y-m-d\TH:i:sP'),
                'total_revenue' => $totalRevenue,
                'settled_orders' => $settledOrders,
                'average_ticket' => $this->averageTicket($totalRevenue, $settledOrders),
                'stores' => $stores,
                'status_counts' => $operations['status_counts'],
                'unserved' => $operations['unserved'],
                'hourly' => $operations['hourly'],
                'menu_ranking' => $operations['menu_ranking'],
                'store_menu_rankings' => $operations['store_menu_rankings'],
            ],
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    /**
     * 選んだ開催日の、提供状況・未提供金額・時間帯・売れ筋。
     * 未提供はキャンセル以外で served_at が空。時間帯と売れ筋はキャンセルを除く。
     *
     * @return array{
     *     status_counts: Collection<int, array<string, mixed>>,
     *     unserved: Collection<int, array<string, mixed>>,
     *     hourly: list<array{hour: int, count: int}>,
     *     menu_ranking: Collection<int, array<string, mixed>>,
     *     store_menu_rankings: Collection<int, array<string, mixed>>
     * }
     */
    private function boothOperations(string $day): array
    {
        $orders = $this->ordersForDay($day);
        $byStore = $orders->groupBy('store_id');

        $statusCounts = Store::query()
            ->get(['id', 'name'])
            ->map(function (Store $store) use ($byStore) {
                $rows = $byStore->get($store->id, collect());
                $open = $rows->where('status', '!=', 'canceled');

                return [
                    'store_id' => (string) $store->id,
                    'store_name' => $store->name,
                    'served' => $open->whereNotNull('served_at')->count(),
                    'unserved' => $open->whereNull('served_at')->count(),
                    'canceled' => $rows->where('status', 'canceled')->count(),
                ];
            })
            ->sort(fn (array $left, array $right) => $this->byStoreName($left, $right))
            ->values();

        $unserved = $statusCounts
            ->map(function (array $row) use ($byStore) {
                $rows = $byStore->get($row['store_id'], collect())
                    ->where('status', '!=', 'canceled')
                    ->whereNull('served_at');

                return [
                    'store_id' => $row['store_id'],
                    'store_name' => $row['store_name'],
                    'count' => $rows->count(),
                    'amount' => (int) $rows->sum('total_price'),
                ];
            })
            ->filter(fn (array $row) => $row['count'] > 0)
            ->sort(function (array $left, array $right) {
                if ($left['amount'] !== $right['amount']) {
                    return $right['amount'] <=> $left['amount'];
                }

                return $this->byStoreName($left, $right);
            })
            ->values();

        $menu = $this->menuRankings($day);

        return [
            'status_counts' => $statusCounts,
            'unserved' => $unserved,
            'hourly' => $this->hourlyCounts($orders),
            'menu_ranking' => $menu['menu_ranking'],
            'store_menu_rankings' => $menu['store_menu_rankings'],
        ];
    }

    private function ordersForDay(string $day): Collection
    {
        $query = Order::query();
        $this->limitFestivalDay($query, $day);

        return $query->get(['store_id', 'status', 'total_price', 'ordered_at', 'created_at', 'served_at']);
    }

    /**
     * キャンセルを除いた会計を、会計した時刻（日本時間）の時で数える。
     * 最初と最後の時のあいだは、0件の時も返す。
     *
     * @return list<array{hour: int, count: int}>
     */
    private function hourlyCounts(Collection $orders): array
    {
        $counts = [];

        foreach ($orders as $order) {
            if (! in_array($order->status, ['issued', 'settled'], true)) {
                continue;
            }

            $at = $order->ordered_at ?? $order->created_at;
            if ($at === null) {
                continue;
            }

            $hour = (int) $at->copy()->timezone('Asia/Tokyo')->format('G');
            $counts[$hour] = ($counts[$hour] ?? 0) + 1;
        }

        if ($counts === []) {
            return [];
        }

        $rows = [];
        for ($hour = min(array_keys($counts)); $hour <= max(array_keys($counts)); $hour++) {
            $rows[] = [
                'hour' => $hour,
                'count' => $counts[$hour] ?? 0,
            ];
        }

        return $rows;
    }

    /**
     * キャンセルを除いた明細を、数量の多い順に上位5件。同数は金額、その次は名前。
     *
     * @return array{
     *     menu_ranking: Collection<int, array<string, mixed>>,
     *     store_menu_rankings: Collection<int, array<string, mixed>>
     * }
     */
    private function menuRankings(string $day): array
    {
        $query = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('menu_items', 'menu_items.id', '=', 'order_items.menu_item_id')
            ->whereIn('orders.status', ['issued', 'settled']);
        $this->limitFestivalDay($query, $day, 'orders.festival_day');

        $rows = $query
            ->select('orders.store_id', 'menu_items.name')
            ->selectRaw('SUM(order_items.quantity) as quantity')
            ->selectRaw('SUM(order_items.subtotal) as amount')
            ->groupBy('orders.store_id', 'menu_items.name')
            ->get();

        $names = Store::query()
            ->whereIn('id', $rows->pluck('store_id')->unique()->values())
            ->pluck('name', 'id');

        $overall = $rows
            ->groupBy(fn ($row) => trim((string) $row->name))
            ->map(function (Collection $group, mixed $name) use ($names) {
                $storeNames = $group
                    ->map(fn ($row) => (string) ($names->get($row->store_id) ?? $row->store_id))
                    ->unique()
                    ->sort()
                    ->values();

                return [
                    'name' => trim((string) $name),
                    'store_names' => $storeNames,
                    'quantity' => (int) $group->sum('quantity'),
                    'amount' => (int) $group->sum('amount'),
                ];
            })
            ->sort(fn (array $left, array $right) => $this->byQuantityThenAmount($left, $right))
            ->take(5)
            ->values();

        $byStore = $rows
            ->groupBy('store_id')
            ->map(function (Collection $group, mixed $storeId) use ($names) {
                $storeId = (string) $storeId;

                return [
                    'store_id' => $storeId,
                    'store_name' => (string) ($names->get($storeId) ?? $storeId),
                    'items' => $group
                        ->map(fn ($row) => [
                            'name' => trim((string) $row->name),
                            'quantity' => (int) $row->quantity,
                            'amount' => (int) $row->amount,
                        ])
                        ->sort(fn (array $left, array $right) => $this->byQuantityThenAmount($left, $right))
                        ->take(5)
                        ->values(),
                ];
            })
            ->sort(fn (array $left, array $right) => $this->byStoreName($left, $right))
            ->values();

        return [
            'menu_ranking' => $overall,
            'store_menu_rankings' => $byStore,
        ];
    }

    private function limitFestivalDay(Builder $query, string $day, string $column = 'festival_day'): void
    {
        if ($day === 'all') {
            return;
        }

        if (! DbSchema::hasColumn('orders', 'festival_day')) {
            $query->whereRaw('0 = 1');

            return;
        }

        $query->where($column, $day);
    }

    private function byStoreName(array $left, array $right): int
    {
        return strcmp($left['store_name'], $right['store_name'])
            ?: strcmp($left['store_id'], $right['store_id']);
    }

    private function byQuantityThenAmount(array $left, array $right): int
    {
        if ($left['quantity'] !== $right['quantity']) {
            return $right['quantity'] <=> $left['quantity'];
        }

        if ($left['amount'] !== $right['amount']) {
            return $right['amount'] <=> $left['amount'];
        }

        return strcmp($left['name'], $right['name']);
    }

    private function settledRows(string $day): Collection
    {
        $query = Order::query()->where('status', 'settled');
        $hasDay = DbSchema::hasColumn('orders', 'festival_day');

        if ($day !== 'all') {
            if (! $hasDay) {
                return collect();
            }
            $query->where('festival_day', $day);
        }

        return $query
            ->select('store_id')
            ->selectRaw('SUM(total_price) as revenue')
            ->selectRaw('COUNT(*) as settled_orders')
            ->groupBy('store_id')
            ->get();
    }

    private function averageTicket(int $revenue, int $count): int
    {
        if ($count <= 0) {
            return 0;
        }

        return (int) round($revenue / $count);
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
        if (DbSchema::hasTable('sales_entries')) {
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
            if (DbSchema::hasTable('sales_entries')) {
                $salesEntryCount = SalesEntry::query()->count();
                SalesEntry::query()->delete();
            }

            // 受付番号を 1 から振り直せるようにする
            if (DbSchema::hasTable('ticket_counters')) {
                DB::table('ticket_counters')->delete();
            }

            Store::query()->update(['current_queue_count' => 0]);

            return [
                'orders' => $orderCount,
                'sales_entries' => $salesEntryCount,
            ];
        });

        AuditLog::record($request, 'analytics.reset', null, $deleted);

        return response()->json(['data' => $deleted], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }
}
