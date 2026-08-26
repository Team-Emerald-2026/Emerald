<?php

namespace App\Http\Controllers\Api\V1\Booth\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\DashboardResource;
use App\Models\Order;
use App\Models\SalesEntry;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

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
            'current_wait_min' => ['required', 'integer', 'min:0', 'max:180'],
            'is_open' => ['sometimes', 'boolean'],
        ];

        if (Schema::hasColumn('stores', 'wait_display_mode')) {
            $rules['wait_display_mode'] = ['sometimes', 'string', 'in:minutes,text'];
            $rules['wait_display_text'] = ['nullable', 'string', 'max:255'];
        }

        $store->fill($request->validate($rules));
        $store->save();

        return DashboardResource::make($this->withRevenue($store->refresh()))
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    private function currentStore(): Store
    {
        $storeId = Auth::user()?->store_id;

        if (! $storeId) {
            abort(404, '店舗情報が見つかりません。');
        }

        $columns = ['id', 'name', 'description', 'is_open', 'current_wait_min', 'current_queue_count'];
        if (Schema::hasColumn('stores', 'wait_display_mode')) {
            $columns[] = 'wait_display_mode';
            $columns[] = 'wait_display_text';
        }

        return Store::query()
            ->select($columns)
            ->findOrFail($storeId);
    }

    private function withRevenue(Store $store): Store
    {
        $orderRevenue = 0;
        if (Schema::hasTable('orders')) {
            $orderRevenue = (int) Order::query()
                ->forStore($store->id)
                ->where('status', 'settled')
                ->sum('total_price');
        }

        $salesRevenue = 0;
        if (Schema::hasTable('sales_entries')) {
            $salesRevenue = (int) SalesEntry::query()
                ->forStore($store->id)
                ->sum('amount');
        }

        $store->setAttribute('revenue', $orderRevenue + $salesRevenue);

        return $store;
    }
}
