<?php

namespace App\Http\Controllers\Api\V1\Booth;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\WaitTimeResource;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class WaitTimeController extends Controller
{
    /**
     * ログイン中の店舗の待ち時間・待ち人数を更新する。送った項目だけが更新される。
     *
     * - current_wait_min: 1人当たりの待ち時間（分）
     * - current_queue_count: 待ち人数を、この値にそろえる
     * - current_queue_delta: 待ち人数を、いまの値から増減する（例: +1 / -1）。
     *   注文の登録・提供と同時に操作しても数え違いが起きないよう、
     *   サーバー側で最新の値に足し引きする。current_queue_count とは同時に使えない
     * - crowd_level: 店内の混雑（empty / moderate / crowded）。待ち人数とは別
     */
    public function update(Request $request)
    {
        $storeId = Auth::user()?->store_id;

        if (! $storeId) {
            abort(403);
        }

        Store::ensureCrowdLevelColumn();

        $rules = [
            'current_wait_min' => ['sometimes', 'integer', 'min:0', 'max:180'],
            'current_queue_count' => ['sometimes', 'integer', 'min:0', 'max:999', 'prohibits:current_queue_delta'],
            'current_queue_delta' => ['sometimes', 'integer', 'min:-999', 'max:999'],
            'wait_display_mode' => ['sometimes', 'string', 'in:minutes,text'],
            'wait_display_text' => ['nullable', 'string', 'max:255'],
            'crowd_level' => ['sometimes', 'nullable', 'string', 'in:empty,moderate,crowded'],
        ];

        $validated = $request->validate($rules);

        $delta = $validated['current_queue_delta'] ?? null;
        unset($validated['current_queue_delta']);

        $store = DB::transaction(function () use ($storeId, $validated, $delta) {
            $store = Store::query()->lockForUpdate()->findOrFail($storeId);

            if ($delta !== null) {
                $validated['current_queue_count'] = max(0, min(999, (int) $store->current_queue_count + $delta));
            }

            $store->fill($validated);
            $store->save();

            Cache::forget('api:v1:restaurants:index');

            return $store;
        });

        return WaitTimeResource::make($store)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }
}
