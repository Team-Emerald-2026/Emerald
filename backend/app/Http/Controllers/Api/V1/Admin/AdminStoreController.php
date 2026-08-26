<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminStoreController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $usersByStoreId = User::query()
            ->where('role', 'store')
            ->whereNotNull('store_id')
            ->get(['id', 'store_id', 'login_id'])
            ->keyBy('store_id');

        $revenueByStoreId = Order::query()
            ->select('store_id')
            ->selectRaw('SUM(CASE WHEN status = ? THEN total_price ELSE 0 END) as revenue', ['settled'])
            ->selectRaw('COUNT(*) as order_count')
            ->groupBy('store_id')
            ->get()
            ->keyBy('store_id');

        $stores = Store::query()
            ->orderBy('id')
            ->get()
            ->map(fn (Store $store) => $this->serializeStore(
                $store,
                $usersByStoreId->get($store->id),
                $revenueByStoreId->get($store->id),
            ))
            ->values();

        return response()->json(['data' => $stores], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:1000'],
            'ticket_prefix' => ['nullable', 'string', 'max:16', 'unique:stores,ticket_prefix'],
            'login_id' => ['required', 'string', 'max:255', 'unique:users,login_id'],
            'password' => ['required', 'string', 'min:8'],
            'is_open' => ['sometimes', 'boolean'],
            'current_wait_min' => ['sometimes', 'integer', 'min:0'],
            'current_queue_count' => ['sometimes', 'integer', 'min:0'],
        ]);

        $result = DB::transaction(function () use ($validated) {
            $store = Store::query()->create([
                'id' => $this->makeStoreId(),
                'name' => $validated['name'],
                'description' => $validated['description'],
                'ticket_prefix' => $this->makeTicketPrefix($validated['ticket_prefix'] ?? $validated['name']),
                'is_open' => $validated['is_open'] ?? true,
                'is_visible' => true,
                'current_wait_min' => $validated['current_wait_min'] ?? 0,
                'current_queue_count' => $validated['current_queue_count'] ?? 0,
            ]);

            $user = User::query()->create([
                'store_id' => $store->id,
                'login_id' => $validated['login_id'],
                'password' => Hash::make($validated['password']),
                'role' => 'store',
            ]);

            return $this->serializeStore($store, $user);
        });

        return response()->json(['data' => $result], 201, [], JSON_UNESCAPED_UNICODE);
    }

    public function update(Request $request, string $id)
    {
        $this->authorizeAdmin($request);

        $store = Store::query()->findOrFail($id);
        $storeUser = User::query()
            ->where('role', 'store')
            ->where('store_id', $store->id)
            ->first();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:1000'],
            'ticket_prefix' => [
                'nullable',
                'string',
                'max:16',
                Rule::unique('stores', 'ticket_prefix')->ignore($store->id, 'id'),
            ],
            'login_id' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('users', 'login_id')->ignore($storeUser?->id),
            ],
            'password' => ['nullable', 'string', 'min:8'],
            'is_open' => ['required', 'boolean'],
            'is_visible' => ['required', 'boolean'],
            'current_wait_min' => ['required', 'integer', 'min:0'],
            'current_queue_count' => ['required', 'integer', 'min:0'],
        ]);

        $result = DB::transaction(function () use ($store, $storeUser, $validated) {
            $store->fill([
                'name' => $validated['name'],
                'description' => $validated['description'],
                'ticket_prefix' => $validated['ticket_prefix']
                    ? Str::upper($validated['ticket_prefix'])
                    : $store->ticket_prefix,
                'is_open' => $validated['is_open'],
                'is_visible' => $validated['is_visible'],
                'current_wait_min' => $validated['current_wait_min'],
                'current_queue_count' => $validated['current_queue_count'],
            ]);
            $store->save();

            if ($storeUser && isset($validated['login_id'])) {
                $storeUser->login_id = $validated['login_id'];
                if (!empty($validated['password'])) {
                    $storeUser->password = Hash::make($validated['password']);
                }
                $storeUser->save();
            }

            return $this->serializeStore($store->refresh(), $storeUser?->refresh());
        });

        return response()->json(['data' => $result], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public function destroy(Request $request, string $id)
    {
        $this->authorizeAdmin($request);

        $store = Store::query()->findOrFail($id);
        $store->fill([
            'is_open' => false,
            'is_visible' => false,
        ]);
        $store->save();

        return response()->json(['data' => $this->serializeStore($store->refresh())], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }

    private function serializeStore(Store $store, ?User $user = null, mixed $revenue = null): array
    {
        return [
            'id' => $store->id,
            'name' => $store->name,
            'description' => $store->description,
            'ticket_prefix' => $store->ticket_prefix,
            'is_open' => (bool) $store->is_open,
            'is_visible' => (bool) $store->is_visible,
            'current_wait_min' => (int) $store->current_wait_min,
            'current_queue_count' => (int) $store->current_queue_count,
            'login_id' => $user?->login_id,
            'revenue' => (int) ($revenue?->revenue ?? 0),
            'order_count' => (int) ($revenue?->order_count ?? 0),
        ];
    }

    private function makeStoreId(): string
    {
        do {
            $storeId = 'store-' . Str::lower(Str::random(8));
        } while (Store::query()->whereKey($storeId)->exists());

        return $storeId;
    }

    private function makeTicketPrefix(string $source): string
    {
        $base = preg_replace('/[^A-Z0-9]/', '', Str::upper($source)) ?: 'S';
        $base = Str::limit($base, 3, '');
        $candidate = $base;
        $index = 1;

        while (Store::query()->where('ticket_prefix', $candidate)->exists()) {
            $candidate = Str::limit($base, 2, '') . $index;
            $index++;
        }

        return $candidate;
    }
}
