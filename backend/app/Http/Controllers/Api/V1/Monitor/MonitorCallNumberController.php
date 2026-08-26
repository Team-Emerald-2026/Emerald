<?php

namespace App\Http\Controllers\Api\V1\Monitor;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Store;
use Illuminate\Support\Facades\Schema;

class MonitorCallNumberController extends Controller
{
    public function index()
    {
        $stores = Store::query()
            ->when(Schema::hasColumn('stores', 'is_visible'), fn ($query) => $query->where('is_visible', true))
            ->where('is_open', true)
            ->orderBy('id')
            ->get(['id', 'name']);

        $waitingOrders = Order::query()
            ->waiting()
            ->whereIn('store_id', $stores->pluck('id'))
            ->orderBy('ordered_at')
            ->orderBy('id')
            ->get(['id', 'store_id', 'ticket_number', 'called_at', 'served_at']);

        $grouped = $waitingOrders->groupBy('store_id');

        $data = $stores->map(function (Store $store) use ($grouped) {
            $orders = $grouped->get($store->id, collect());
            $called = $orders->filter(fn (Order $order) => $order->called_at !== null);
            $waiting = $orders->filter(fn (Order $order) => $order->called_at === null);

            return [
                'store_id' => $store->id,
                'store_name' => $store->name,
                'current_call_number' => optional($called->last())->ticket_number,
                'called_numbers' => $called->pluck('ticket_number')->values(),
                'waiting_numbers' => $waiting->pluck('ticket_number')->values(),
                'waiting_count' => $waiting->count(),
            ];
        })->values();

        return response()->json(['data' => $data], 200, [], JSON_UNESCAPED_UNICODE);
    }
}
