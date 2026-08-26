<?php

namespace App\Http\Controllers\Api\V1\Booth\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\DashboardResource;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function index()
    {
        $store = $this->currentStore();

        return DashboardResource::make($store)
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
            'is_open' => ['required', 'boolean'],
        ]);

        $store->fill($validated);
        $store->save();

        return DashboardResource::make($store->refresh())
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    private function currentStore(): Store
    {
        $storeId = Auth::user()?->store_id;

        if (! $storeId) {
            abort(404, '店舗情報が見つかりません。');
        }

        return Store::query()
            ->select([
                'id',
                'name',
                'description',
                'is_open',
                'current_wait_min',
                'current_queue_count',
            ])
            ->findOrFail($storeId);
    }
}
