<?php

namespace App\Http\Controllers\Api\V1\Booth\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\Accounting\MenuItemResource;
use App\Http\Resources\Booth\Accounting\OrderResource;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AccountingController extends Controller
{
    public function menuItems()
    {
        $storeId = $this->currentStoreId();

        $menuItems = MenuItem::query()
            ->forStore($storeId)
            ->where('is_available', true)
            ->select(['id', 'name', 'description', 'price', 'is_available'])
            ->orderBy('id')
            ->get();

        return MenuItemResource::collection($menuItems)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function storeMenuItem(Request $request)
    {
        $validated = $this->validateMenuItem($request);

        $item = MenuItem::query()->create([
            'store_id' => $this->currentStoreId(),
            'name' => $validated['name'],
            'description' => null,
            'price' => $validated['price'],
            'is_available' => true,
        ]);

        return MenuItemResource::make($item)
            ->response()
            ->setStatusCode(201)
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function updateMenuItem(Request $request, int $id)
    {
        $item = $this->findStoreMenuItem($id);
        if (! $item) {
            return $this->menuItemNotFound();
        }

        $validated = $this->validateMenuItem($request);
        $item->fill([
            'name' => $validated['name'],
            'price' => $validated['price'],
        ]);
        $item->save();

        return MenuItemResource::make($item->refresh())
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function destroyMenuItem(int $id)
    {
        $item = $this->findStoreMenuItem($id);
        if (! $item) {
            return $this->menuItemNotFound();
        }

        $usedInOrders = OrderItem::query()
            ->where('menu_item_id', $item->id)
            ->exists();

        if ($usedInOrders) {
            $item->is_available = false;
            $item->save();
        } else {
            $item->delete();
        }

        return response()->json(null, 204);
    }

    public function index(Request $request)
    {
        $storeId = $this->currentStoreId();

        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:issued,settled,canceled'],
        ]);

        $orders = Order::query()
            ->forStore($storeId)
            ->with(['items' => function ($query) {
                $query->select([
                    'id',
                    'order_id',
                    'menu_item_id',
                    'quantity',
                    'unit_price',
                    'subtotal',
                ]);
            }])
            ->when(isset($validated['status']), function ($query) use ($validated) {
                $query->where('status', $validated['status']);
            })
            ->orderByDesc('id')
            ->get();

        return OrderResource::collection($orders)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function show(int $id)
    {
        $storeId = $this->currentStoreId();

        $order = Order::query()
            ->forStore($storeId)
            ->with(['items' => function ($query) {
                $query->select([
                    'id',
                    'order_id',
                    'menu_item_id',
                    'quantity',
                    'unit_price',
                    'subtotal',
                ]);
            }])
            ->find($id);

        if (!$order) {
            return response()->json([
                'errors' => [[
                    'status' => '404',
                    'title' => 'Not Found',
                    'detail' => '指定した会計が見つかりません',
                ]],
            ], 404, [], JSON_UNESCAPED_UNICODE);
        }

        return OrderResource::make($order)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function showByTicket(string $ticketNumber)
    {
        $storeId = $this->currentStoreId();

        $order = Order::query()
            ->forStore($storeId)
            ->with(['items' => function ($query) {
                $query->select([
                    'id',
                    'order_id',
                    'menu_item_id',
                    'quantity',
                    'unit_price',
                    'subtotal',
                ]);
            }])
            ->where('ticket_number', strtoupper($ticketNumber))
            ->first();

        if (!$order) {
            return response()->json([
                'errors' => [[
                    'status' => '404',
                    'title' => 'Not Found',
                    'detail' => '指定した会計番号が見つかりません',
                ]],
            ], 404, [], JSON_UNESCAPED_UNICODE);
        }

        return OrderResource::make($order)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function store(Request $request)
    {
        $storeId = $this->currentStoreId();

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => [
                'required',
                'integer',
                Rule::exists('menu_items', 'id')->where(function ($query) use ($storeId) {
                    $query->where('store_id', $storeId)->where('is_available', true);
                }),
            ],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $requestedItems = collect($validated['items'])
            ->groupBy('menu_item_id')
            ->map(function ($items, $menuItemId) {
                return [
                    'menu_item_id' => (int) $menuItemId,
                    'quantity' => collect($items)->sum('quantity'),
                ];
            })
            ->values();

        $menuItemIds = $requestedItems
            ->pluck('menu_item_id')
            ->unique()
            ->values();

        $menuItems = MenuItem::query()
            ->forStore($storeId)
            ->where('is_available', true)
            ->whereIn('id', $menuItemIds)
            ->get()
            ->keyBy('id');

        $result = DB::transaction(function () use ($requestedItems, $storeId, $menuItems) {
            $ticketNumber = $this->generateNextTicketNumber($storeId);
            $totalPrice = 0;

            $normalizedItems = [];
            foreach ($requestedItems as $item) {
                $menuItem = $menuItems->get($item['menu_item_id']);
                $subtotal = $menuItem->price * $item['quantity'];
                $totalPrice += $subtotal;

                $normalizedItems[] = [
                    'menu_item_id' => $menuItem->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $menuItem->price,
                    'subtotal' => $subtotal,
                ];
            }

            $order = Order::query()->create([
                'store_id' => $storeId,
                'ticket_number' => $ticketNumber,
                'total_price' => $totalPrice,
                'status' => 'issued',
                'ordered_at' => now(),
            ]);

            foreach ($normalizedItems as $normalizedItem) {
                $order->items()->create($normalizedItem);
            }

            Store::query()->whereKey($storeId)->increment('current_queue_count');

            return $order->load(['items' => function ($query) {
                $query->select([
                    'id',
                    'order_id',
                    'menu_item_id',
                    'quantity',
                    'unit_price',
                    'subtotal',
                ]);
            }]);
        });

        return OrderResource::make($result)
            ->response()
            ->setStatusCode(201)
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function settle(int $id)
    {
        $storeId = $this->currentStoreId();

        $order = Order::query()
            ->forStore($storeId)
            ->find($id);

        if (!$order) {
            return response()->json([
                'errors' => [[
                    'status' => '404',
                    'title' => 'Not Found',
                    'detail' => '指定した会計が見つかりません',
                ]],
            ], 404, [], JSON_UNESCAPED_UNICODE);
        }

        if ($order->status === 'settled') {
            return response()->json([
                'errors' => [[
                    'status' => '409',
                    'title' => 'Conflict',
                    'detail' => 'この会計はすでに清算済みです',
                ]],
            ], 409, [], JSON_UNESCAPED_UNICODE);
        }

        $order->status = 'settled';
        $order->settled_at = now();
        $order->save();

        return OrderResource::make($order)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function call(int $id)
    {
        $order = $this->findStoreOrder($id);

        if (! $order) {
            return $this->orderNotFound();
        }

        if ($order->served_at !== null || $order->status === 'canceled') {
            return response()->json([
                'error' => [
                    'code' => 'CONFLICT',
                    'message' => 'この会計は呼び出しできません',
                    'details' => ['status' => $order->status],
                ],
            ], 409, [], JSON_UNESCAPED_UNICODE);
        }

        $order->called_at = now();
        $order->save();

        return OrderResource::make($order)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function serve(int $id)
    {
        $order = $this->findStoreOrder($id);

        if (! $order) {
            return $this->orderNotFound();
        }

        if ($order->served_at !== null || $order->status === 'canceled') {
            return response()->json([
                'error' => [
                    'code' => 'CONFLICT',
                    'message' => 'この会計はすでに提供済みです',
                    'details' => ['status' => $order->status],
                ],
            ], 409, [], JSON_UNESCAPED_UNICODE);
        }

        $wasWaiting = $order->served_at === null;
        $order->called_at = $order->called_at ?? now();
        $order->served_at = now();
        $order->save();

        if ($wasWaiting) {
            Store::query()
                ->whereKey($this->currentStoreId())
                ->where('current_queue_count', '>', 0)
                ->decrement('current_queue_count');
        }

        return OrderResource::make($order)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    private function findStoreOrder(int $id): ?Order
    {
        return Order::query()
            ->forStore($this->currentStoreId())
            ->with(['items' => function ($query) {
                $query->select([
                    'id',
                    'order_id',
                    'menu_item_id',
                    'quantity',
                    'unit_price',
                    'subtotal',
                ]);
            }])
            ->find($id);
    }

    private function orderNotFound()
    {
        return response()->json([
            'error' => [
                'code' => 'NOT_FOUND',
                'message' => '指定した会計が見つかりません',
                'details' => ['field' => 'id'],
            ],
        ], 404, [], JSON_UNESCAPED_UNICODE);
    }

    private function generateNextTicketNumber(string $storeId): string
    {
        // Use a dedicated ticket_counters table to atomically increment per-store counters.
        // Each store owns its own prefix, so ticket numbers stay readable and unique.
        return DB::transaction(function () use ($storeId) {
            $prefix = $this->ticketPrefixForStoreId($storeId);

            $counter = DB::table('ticket_counters')
                ->where('store_id', $storeId)
                ->lockForUpdate()
                ->first();

            // First ticket for this store: determine starting point from existing orders to avoid collisions.
            if (!$counter) {
                // Find max numeric suffix from existing ticket_numbers like '<prefix>-<num>'
                $max = Order::query()
                    ->where('store_id', $storeId)
                    ->where('ticket_number', 'like', $prefix . '-%')
                    ->selectRaw('MAX(CAST(SUBSTRING(ticket_number, ?) AS UNSIGNED)) as max', [strlen($prefix) + 2])
                    ->value('max');

                // If no existing tickets, start at 101; otherwise start at max + 1
                $start = ($max ? (int) $max : 100) + 1;

                DB::table('ticket_counters')->insert([
                    'store_id' => $storeId,
                    'last_number' => $start,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return $prefix . '-' . $start;
            }

            $nextNumber = (int) $counter->last_number + 1;

            DB::table('ticket_counters')
                ->where('store_id', $storeId)
                ->update([
                    'last_number' => $nextNumber,
                    'updated_at' => now(),
                ]);

            return $prefix . '-' . $nextNumber;
        });
    }

    private function currentStoreId(): string
    {
        return Auth::user()->store_id;
    }

    private function validateMenuItem(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'price' => ['required', 'integer', 'min:0', 'max:10000000'],
        ]);
    }

    private function findStoreMenuItem(int $id): ?MenuItem
    {
        return MenuItem::query()
            ->forStore($this->currentStoreId())
            ->where('is_available', true)
            ->find($id);
    }

    private function menuItemNotFound()
    {
        return response()->json([
            'error' => [
                'code' => 'NOT_FOUND',
                'message' => '指定した商品が見つかりません',
                'details' => ['field' => 'id'],
            ],
        ], 404, [], JSON_UNESCAPED_UNICODE);
    }

    private function ticketPrefixForStoreId(string $storeId): string
    {
        $prefix = Store::query()
            ->whereKey($storeId)
            ->value('ticket_prefix');

        return $prefix ?: strtoupper(substr($storeId, -1));
    }
}
