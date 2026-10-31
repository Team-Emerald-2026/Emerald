<?php

namespace App\Http\Controllers\Api\V1\Booth\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\DashboardResource;
use App\Models\MapFacilities;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\SalesEntry;
use App\Models\Store;
use App\Support\DbSchema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $store = $this->currentStore();

        return DashboardResource::make($this->withRevenue($store))
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function update(Request $request, string $id)
    {
        $store = $this->currentStore();

        if ((string) $store->id !== (string) $id) {
            abort(403, '他店舗の情報は更新できません。');
        }

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:1000'],
            // 1人当たりの待ち時間（分）。来場者画面は待ち人数の表示になったため、送らなくてもよい
            'current_wait_min' => ['sometimes', 'integer', 'min:0', 'max:180'],
            'is_open' => ['required', 'boolean'],
            'type' => ['sometimes', 'string', 'in:booth,food,exhibit,information,shop,circle_sales,stage'],
        ];

        if (DbSchema::hasColumn('stores', 'wait_display_mode')) {
            $rules['wait_display_mode'] = ['sometimes', 'string', 'in:minutes,text'];
            $rules['wait_display_text'] = ['nullable', 'string', 'max:255'];
        }

        if (DbSchema::hasColumn('stores', 'ticket_limit')) {
            // 整理券の枚数（1〜この番号までを使い回す）
            $rules['ticket_limit'] = ['sometimes', 'integer', 'min:1', 'max:999'];
            // 非表示（紛失など）にした整理券の番号。発番時に飛ばす
            $rules['disabled_ticket_numbers'] = ['sometimes', 'array', 'max:999'];
            $rules['disabled_ticket_numbers.*'] = ['integer', 'min:1', 'max:999'];
        }

        $validated = $request->validate($rules);

        if (array_key_exists('disabled_ticket_numbers', $validated)) {
            $validated['disabled_ticket_numbers'] = collect($validated['disabled_ticket_numbers'])
                ->map(fn ($number) => (int) $number)
                ->unique()
                ->sort()
                ->values()
                ->all();
        }
        $boothType = $validated['type'] ?? null;
        unset($validated['type']);

        $store->fill($validated);
        $store->save();

        if (is_string($boothType)) {
            $this->syncBoothType($store, $boothType);
        }

        return DashboardResource::make($this->withRevenue($this->loadDashboardStore($store->id)))
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    private function currentStore(): Store
    {
        $storeId = Auth::user()?->store_id;

        if (! $storeId) {
            abort(404, '店舗情報が見つかりません。');
        }

        Store::ensureCrowdLevelColumn();
        Store::ensureTicketLimitDefault();

        $columns = ['id', 'name', 'description', 'is_open', 'current_wait_min', 'current_queue_count'];
        if (DbSchema::hasColumn('stores', 'wait_display_mode')) {
            $columns[] = 'wait_display_mode';
            $columns[] = 'wait_display_text';
        }
        if (Store::hasCrowdLevelColumn()) {
            $columns[] = 'crowd_level';
        }
        if (DbSchema::hasColumn('stores', 'ticket_limit')) {
            $columns[] = 'ticket_limit';
            $columns[] = 'disabled_ticket_numbers';
        }

        return $this->loadDashboardStore($storeId, $columns);
    }

    private function loadDashboardStore(string $storeId, ?array $columns = null): Store
    {
        $query = Store::query();
        if ($columns !== null) {
            $query->select($columns);
        }

        return $query
            ->with('mapFacility:id,store_id,type')
            ->findOrFail($storeId);
    }

    private function syncBoothType(Store $store, string $type): void
    {
        $facility = MapFacilities::query()->where('store_id', $store->id)->first();

        if ($facility) {
            $facility->type = $type;
            $facility->name = $store->name;
            $facility->save();

            return;
        }

        MapFacilities::query()->create([
            'store_id' => $store->id,
            'name' => $store->name,
            'type' => $type,
            'floor' => 1,
            'x' => 50,
            'y' => 50,
        ]);
    }

    private function withRevenue(Store $store): Store
    {
        $orderRevenue = 0;
        $settledOrderCount = 0;
        if (DbSchema::hasTable('orders')) {
            $settledOrders = Order::query()
                ->forStore($store->id)
                ->where('status', 'settled')
                ->selectRaw('COUNT(*) as order_count, COALESCE(SUM(total_price), 0) as revenue')
                ->first();

            $orderRevenue = (int) ($settledOrders->revenue ?? 0);
            $settledOrderCount = (int) ($settledOrders->order_count ?? 0);
        }

        $salesRevenue = 0;
        if (DbSchema::hasTable('sales_entries')) {
            $salesRevenue = (int) SalesEntry::query()
                ->forStore($store->id)
                ->sum('amount');
        }

        $store->setAttribute('revenue', $orderRevenue + $salesRevenue);
        $store->setAttribute('order_revenue', $orderRevenue);
        $store->setAttribute('sales_entry_revenue', $salesRevenue);
        $store->setAttribute('settled_order_count', $settledOrderCount);
        $store->setAttribute('item_sales', $this->itemSales($store->id));

        return $store;
    }

    /**
     * 商品ごとの売上数・売上金額（清算済みの会計だけを集計する）。
     * 売れた数が多い順に並べる。
     */
    private function itemSales(string $storeId): array
    {
        if (! DbSchema::hasTable('orders') || ! DbSchema::hasTable('order_items')) {
            return [];
        }

        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('menu_items', 'menu_items.id', '=', 'order_items.menu_item_id')
            ->where('orders.store_id', $storeId)
            ->where('orders.status', 'settled')
            ->groupBy('order_items.menu_item_id', 'menu_items.name')
            ->select([
                'order_items.menu_item_id',
                'menu_items.name',
                DB::raw('SUM(order_items.quantity) as quantity'),
                DB::raw('SUM(order_items.subtotal) as subtotal'),
            ])
            ->orderByDesc(DB::raw('SUM(order_items.quantity)'))
            ->get()
            ->map(fn ($row) => [
                'menu_item_id' => (int) $row->menu_item_id,
                'name' => (string) ($row->name ?? '削除済みの商品'),
                'quantity' => (int) $row->quantity,
                'subtotal' => (int) $row->subtotal,
            ])
            ->values()
            ->all();
    }
}
