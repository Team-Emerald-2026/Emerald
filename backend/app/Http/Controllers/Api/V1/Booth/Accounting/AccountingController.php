<?php

namespace App\Http\Controllers\Api\V1\Booth\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\Accounting\MenuItemResource;
use App\Http\Resources\Booth\Accounting\OrderResource;
use App\Models\FestivalSetting;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Store;
use App\Support\DbSchema;
use Illuminate\Http\Exceptions\HttpResponseException;
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
            ->select(['id', 'name', 'description', 'price', 'is_available', 'is_sold_out'])
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

    /**
     * 商品の売り切れを切り替える。売り切れ中もメニューには表示し、注文だけ受け付けない。
     */
    public function updateMenuItemSoldOut(Request $request, int $id)
    {
        $item = $this->findStoreMenuItem($id);
        if (! $item) {
            return $this->menuItemNotFound();
        }

        $validated = $request->validate([
            'is_sold_out' => ['required', 'boolean'],
        ]);

        $item->is_sold_out = (bool) $validated['is_sold_out'];
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
            ->with(['items' => $this->itemsWithNames()])
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
            ->with(['items' => $this->itemsWithNames()])
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
            ->with(['items' => $this->itemsWithNames()])
            ->where('ticket_number', strtoupper($ticketNumber))
            // 整理券の番号は使い回すため、同じ番号では最新の会計を返す
            ->orderByDesc('id')
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
            // true の場合、注文の作成と同じ処理の中で精算済みにする（レジで会計と同時に番号を出す用）
            'settle' => ['sometimes', 'boolean'],
        ]);
        $settleNow = (bool) ($validated['settle'] ?? false);

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

        $soldOutItems = $menuItems->filter(fn (MenuItem $menuItem) => $menuItem->is_sold_out);
        if ($soldOutItems->isNotEmpty()) {
            return response()->json([
                'error' => [
                    'code' => 'SOLD_OUT',
                    'message' => '売り切れの商品が含まれています: ' . $soldOutItems->pluck('name')->implode('、'),
                    'details' => ['menu_item_ids' => $soldOutItems->keys()->values()],
                ],
            ], 409, [], JSON_UNESCAPED_UNICODE);
        }

        $result = DB::transaction(function () use ($requestedItems, $storeId, $menuItems, $settleNow) {
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
                'status' => $settleNow ? 'settled' : 'issued',
                'ordered_at' => now(),
                'settled_at' => $settleNow ? now() : null,
            ]);

            foreach ($normalizedItems as $normalizedItem) {
                $order->items()->create($normalizedItem);
            }

            Store::query()->whereKey($storeId)->increment('current_queue_count');

            return $order->load(['items' => $this->itemsWithNames()]);
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

        if ($order->status === 'canceled') {
            return response()->json([
                'errors' => [[
                    'status' => '409',
                    'title' => 'Conflict',
                    'detail' => 'キャンセル済みの会計は清算できません',
                ]],
            ], 409, [], JSON_UNESCAPED_UNICODE);
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
        if (blank($order->festival_day) && DbSchema::hasColumn('orders', 'festival_day')) {
            $order->festival_day = FestivalSetting::currentDay();
        }
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

    /**
     * 提供済みを取り消して、提供待ちに戻す（誤操作の取り消し用）。
     * 呼び出し済みの状態も戻し、待ち人数を1人分戻す。
     */
    public function unserve(int $id)
    {
        $order = $this->findStoreOrder($id);

        if (! $order) {
            return $this->orderNotFound();
        }

        if ($order->served_at === null || $order->status === 'canceled') {
            return response()->json([
                'error' => [
                    'code' => 'CONFLICT',
                    'message' => 'この会計は提供済みではないため、戻せません',
                    'details' => ['status' => $order->status],
                ],
            ], 409, [], JSON_UNESCAPED_UNICODE);
        }

        DB::transaction(function () use ($order) {
            $order->served_at = null;
            $order->called_at = null;
            $order->save();

            Store::query()
                ->whereKey($this->currentStoreId())
                ->increment('current_queue_count');
        });

        return OrderResource::make($order)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    /**
     * 提供前の注文（提供待ち・呼び出し中）をキャンセルする。
     * 売上と呼び出し・待ち人数の対象から外れ、待ち人数を1人分減らす。
     * 返金はアプリの外で行う前提（このAPIは記録だけを変える）。
     */
    public function cancel(int $id)
    {
        $order = $this->findStoreOrder($id);

        if (! $order) {
            return $this->orderNotFound();
        }

        // 同時に2回押されても、待ち人数を二重に減らさないよう、行をロックして状態を確かめ直す
        $canceled = DB::transaction(function () use ($order) {
            $locked = Order::query()->lockForUpdate()->find($order->id);

            if (! $locked || $locked->served_at !== null || $locked->status === 'canceled') {
                return false;
            }

            $locked->status = 'canceled';
            $locked->save();

            Store::query()
                ->whereKey($this->currentStoreId())
                ->where('current_queue_count', '>', 0)
                ->decrement('current_queue_count');

            return true;
        });

        // 最新の状態（商品名つき）を読み直す
        $order = $this->findStoreOrder($id);

        if (! $canceled) {
            return response()->json([
                'error' => [
                    'code' => 'CONFLICT',
                    'message' => $order->status === 'canceled'
                        ? 'この会計はすでにキャンセル済みです'
                        : '提供済みの会計はキャンセルできません',
                    'details' => ['status' => $order->status],
                ],
            ], 409, [], JSON_UNESCAPED_UNICODE);
        }

        return OrderResource::make($order)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    private function findStoreOrder(int $id): ?Order
    {
        return Order::query()
            ->forStore($this->currentStoreId())
            ->with(['items' => $this->itemsWithNames()])
            ->find($id);
    }

    /**
     * 注文の明細を、商品名つきで読み込むための条件。
     * 販売停止にしたメニューは削除されず非表示になるだけなので、過去の注文でも商品名を引ける。
     */
    private function itemsWithNames(): \Closure
    {
        return function ($query) {
            $query
                ->select(['id', 'order_id', 'menu_item_id', 'quantity', 'unit_price', 'subtotal'])
                ->with('menuItem:id,name');
        };
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

    /**
     * 整理券の番号を発番する（数字だけ。紙の整理券に店名があるため頭文字は付けない）。
     *
     * 整理券は「1〜枚数（店舗ごとに設定、既定20）」を順番に使い回す。
     * 次の番号は、前回発番した番号の次から探し、上限を超えたら1に戻る。
     * 以下の番号は飛ばす:
     * - 非表示（紛失など）にした番号（店舗情報の設定）
     * - 提供前の注文（提供待ち・呼び出し中）が使っている番号（まだ手元に戻っていない）
     * すべて埋まっている場合は 409（NO_TICKET_AVAILABLE）を返す。
     */
    private function generateNextTicketNumber(string $storeId): string
    {
        return DB::transaction(function () use ($storeId) {
            Store::ensureTicketLimitDefault();
            $store = Store::query()->whereKey($storeId)->firstOrFail();
            $limit = max(1, (int) ($store->ticket_limit ?? 20));

            // 同じ店の発番が同時に走らないよう、カウンター行をロックして直列化する
            $counter = DB::table('ticket_counters')
                ->where('store_id', $storeId)
                ->lockForUpdate()
                ->first();

            $disabled = collect($store->disabled_ticket_numbers ?? [])
                ->map(fn ($number) => (int) $number);

            // 提供前（キャンセル以外）の注文が持っている番号
            // 旧形式「C-12」と新形式「12」のどちらでも数字部分を取る
            $inUse = Order::query()
                ->forStore($storeId)
                ->whereNull('served_at')
                ->where('status', '!=', 'canceled')
                ->pluck('ticket_number')
                ->map(fn ($number) => $this->ticketNumberValue((string) $number))
                ->filter(fn ($number) => $number !== null);

            $unavailable = $disabled->merge($inUse)->flip();

            $last = $counter ? (int) $counter->last_number : 0;

            $next = null;
            for ($step = 1; $step <= $limit; $step++) {
                $candidate = (($last + $step - 1) % $limit) + 1;
                if (! $unavailable->has($candidate)) {
                    $next = $candidate;
                    break;
                }
            }

            if ($next === null) {
                throw new HttpResponseException(response()->json([
                    'error' => [
                        'code' => 'NO_TICKET_AVAILABLE',
                        'message' => '使える整理券がありません。提供完了やキャンセルで整理券を戻すか、店舗情報で整理券の枚数を増やしてください。',
                        'details' => ['ticket_limit' => $limit],
                    ],
                ], 409, [], JSON_UNESCAPED_UNICODE));
            }

            if ($counter) {
                DB::table('ticket_counters')
                    ->where('store_id', $storeId)
                    ->update([
                        'last_number' => $next,
                        'updated_at' => now(),
                    ]);
            } else {
                DB::table('ticket_counters')->insert([
                    'store_id' => $storeId,
                    'last_number' => $next,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return (string) $next;
        });
    }

    /** 受付番号文字列から数字部分を取り出す。取れなければ null */
    private function ticketNumberValue(string $ticketNumber): ?int
    {
        if (preg_match('/(\d+)$/', $ticketNumber, $matches) !== 1) {
            return null;
        }

        return (int) $matches[1];
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

}
