<?php

namespace App\Http\Controllers\Api\V1\Booth\Sales;

use App\Http\Controllers\Controller;
use App\Http\Resources\SalesEntryResource;
use App\Models\SalesEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SalesController extends Controller
{
    public function index()
    {
        $entries = SalesEntry::query()
            ->forStore($this->currentStoreId())
            ->orderByDesc('recorded_at')
            ->orderByDesc('id')
            ->get();

        return SalesEntryResource::collection($entries)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:0', 'max:10000000'],
            'memo' => ['nullable', 'string', 'max:255'],
            'recorded_at' => ['nullable', 'date'],
        ]);

        $entry = SalesEntry::query()->create([
            'store_id' => $this->currentStoreId(),
            'amount' => $validated['amount'],
            'memo' => $validated['memo'] ?? null,
            'recorded_at' => $validated['recorded_at'] ?? now(),
        ]);

        return SalesEntryResource::make($entry)
            ->response()
            ->setStatusCode(201)
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function update(Request $request, int $id)
    {
        $entry = SalesEntry::query()
            ->forStore($this->currentStoreId())
            ->find($id);

        if (! $entry) {
            return $this->notFound();
        }

        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:0', 'max:10000000'],
            'memo' => ['nullable', 'string', 'max:255'],
            'recorded_at' => ['nullable', 'date'],
        ]);

        $entry->fill([
            'amount' => $validated['amount'],
            'memo' => $validated['memo'] ?? null,
            'recorded_at' => $validated['recorded_at'] ?? $entry->recorded_at,
        ]);
        $entry->save();

        return SalesEntryResource::make($entry->refresh())
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function destroy(int $id)
    {
        $entry = SalesEntry::query()
            ->forStore($this->currentStoreId())
            ->find($id);

        if (! $entry) {
            return $this->notFound();
        }

        $entry->delete();

        return response()->json(null, 204);
    }

    private function currentStoreId(): string
    {
        $storeId = Auth::user()?->store_id;

        if (! $storeId) {
            abort(404, '店舗情報が見つかりません。');
        }

        return $storeId;
    }

    private function notFound()
    {
        return response()->json([
            'error' => [
                'code' => 'NOT_FOUND',
                'message' => '指定した売上記録が見つかりません',
                'details' => ['field' => 'id'],
            ],
        ], 404, [], JSON_UNESCAPED_UNICODE);
    }
}
