<?php

namespace App\Http\Controllers\Api\V1\CallNumber;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class CallNumberController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'store_id' => ['nullable', 'string', 'max:64'],
        ]);

        $orders = Order::query()
            ->currentlyCalled()
            ->with(['store:id,name,is_visible,is_open'])
            ->when(isset($validated['store_id']), fn ($query) => $query->where('store_id', $validated['store_id']))
            ->when(
                Schema::hasColumn('stores', 'is_visible'),
                fn ($query) => $query->whereHas('store', fn ($store) => $store->where('is_visible', true)),
            )
            ->orderBy('called_at')
            ->get();

        $data = $orders->map(fn (Order $order) => [
            'id' => (string) $order->id,
            'store_id' => $order->store_id,
            'store_name' => $order->store?->name,
            'ticket_number' => $order->ticket_number,
            'called_at' => optional($order->called_at)->toISOString(),
        ])->values();

        return response()->json(['data' => $data], 200, [], JSON_UNESCAPED_UNICODE);
    }
}
