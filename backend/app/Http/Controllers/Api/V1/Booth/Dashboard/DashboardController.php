<?php

namespace App\Http\Controllers\Api\V1\Booth\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\DashboardResource;
use App\Models\Order;
use App\Models\SalesEntry;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:1000'],
            'current_wait_min' => ['required', 'integer', 'min:0', 'max:180'],
            'is_open' => ['sometimes', 'boolean'],
            'wait_display_mode' => ['sometimes', 'string', 'in:minutes,text'],
            'wait_display_text' => ['nullable', 'string', 'max:255'],
        ]);

        $store->fill($validated);
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

        return Store::query()->findOrFail($storeId);
    }

    private function withRevenue(Store $store): Store
    {
        $orderRevenue = (int) Order::query()
            ->forStore($store->id)
            ->where('status', 'settled')
            ->sum('total_price');
        $salesRevenue = (int) SalesEntry::query()
            ->forStore($store->id)
            ->sum('amount');

        $store->setAttribute('revenue', $orderRevenue + $salesRevenue);

        return $store;
    }
}
