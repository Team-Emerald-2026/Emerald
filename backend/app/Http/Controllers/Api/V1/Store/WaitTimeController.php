<?php

namespace App\Http\Controllers\Api\V1\Store;

use App\Http\Controllers\Controller;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class WaitTimeController extends Controller
{
    public function update(Request $request, string $id)
    {
        $store = Store::query()->find($id);

        if (! $store) {
            return response()->json([
                'error' => [
                    'code' => 'NOT_FOUND',
                    'message' => '指定した店舗が見つかりません',
                    'details' => ['field' => 'id'],
                ],
            ], 404, [], JSON_UNESCAPED_UNICODE);
        }

        $user = Auth::user();
        $isAdmin = $user?->role === 'admin';
        $ownsStore = (string) $user?->store_id === (string) $store->id;

        if (! $isAdmin && ! $ownsStore) {
            abort(403, '自店舗以外の待ち時間を更新しようとした場合');
        }

        $validated = $request->validate([
            'current_wait_min' => ['required', 'integer', 'min:0', 'max:180'],
            'current_queue_count' => ['required', 'integer', 'min:0', 'max:999'],
            'wait_display_mode' => ['sometimes', 'string', 'in:minutes,text'],
            'wait_display_text' => ['nullable', 'string', 'max:255'],
        ]);

        $store->fill($validated);
        $store->save();

        return response()->json([
            'id' => $store->id,
            'current_wait_min' => (int) $store->current_wait_min,
            'current_queue_count' => (int) $store->current_queue_count,
            'wait_display_mode' => $store->wait_display_mode ?? 'minutes',
            'wait_display_text' => $store->wait_display_text,
            'updated_at' => optional($store->updated_at)->toISOString(),
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }
}
