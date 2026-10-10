<?php

namespace App\Http\Controllers\Api\V1\Booth;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\WaitTimeResource;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class WaitTimeController extends Controller
{
    public function update(Request $request)
    {
        $storeId = Auth::user()?->store_id;

        if (! $storeId) {
            abort(403);
        }

        $store = Store::query()->findOrFail($storeId);

        $validated = $request->validate([
            'current_wait_min' => ['required', 'integer', 'min:0', 'max:180'],
            'current_queue_count' => ['required', 'integer', 'min:0', 'max:999'],
            'wait_display_mode' => ['sometimes', 'string', 'in:minutes,text'],
            'wait_display_text' => ['nullable', 'string', 'max:255'],
        ]);

        $store->fill($validated);
        $store->save();

        return WaitTimeResource::make($store)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }
}
