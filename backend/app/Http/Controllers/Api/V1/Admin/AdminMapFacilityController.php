<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\MapFacilities;
use App\Models\Store;
use Illuminate\Http\Request;

/**
 * 管理画面の「マップ編集」用API。
 * 場所（ピン）の一覧・追加・移動・削除を行う。
 * 店舗に紐づいたピン（store_id あり）は、店舗側で管理するため削除できない。
 */
class AdminMapFacilityController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $facilities = MapFacilities::query()
            ->orderBy('floor')
            ->orderBy('id')
            ->get();

        $stores = Store::query()
            ->whereIn('id', $facilities->pluck('store_id')->filter()->unique()->values())
            ->get()
            ->keyBy('id');

        return response()->json([
            'data' => $facilities
                ->map(fn (MapFacilities $facility) => $this->serialize($facility, $stores->get($facility->store_id)))
                ->values(),
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'max:64'],
            'floor' => ['required', 'integer', 'min:1', 'max:8'],
            'x' => ['required', 'integer', 'min:0', 'max:100'],
            'y' => ['required', 'integer', 'min:0', 'max:100'],
        ]);

        // この画面から作るのは「店舗がまだ入っていない場所」だけ
        $facility = MapFacilities::query()->create([
            'store_id' => null,
            'name' => trim($validated['name']),
            'type' => $validated['type'],
            'floor' => $validated['floor'],
            'x' => $validated['x'],
            'y' => $validated['y'],
        ]);

        return response()->json(['data' => $this->serialize($facility)], 201, [], JSON_UNESCAPED_UNICODE);
    }

    public function update(Request $request, string $id)
    {
        $this->authorizeAdmin($request);

        $facility = MapFacilities::query()->findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'string', 'max:64'],
            'floor' => ['sometimes', 'integer', 'min:1', 'max:8'],
            'x' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'y' => ['sometimes', 'integer', 'min:0', 'max:100'],
        ]);

        // 店舗に紐づくピンの名前・種類は店舗情報（店舗管理）が元になるので、ここでは位置だけ変える
        if ($facility->store_id !== null) {
            unset($validated['name'], $validated['type']);
        } elseif (isset($validated['name'])) {
            $validated['name'] = trim($validated['name']);
        }

        $facility->fill($validated)->save();

        $store = $facility->store_id !== null
            ? Store::query()->find($facility->store_id)
            : null;

        return response()->json(['data' => $this->serialize($facility->refresh(), $store)], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public function destroy(Request $request, string $id)
    {
        $this->authorizeAdmin($request);

        $facility = MapFacilities::query()->findOrFail($id);

        if ($facility->store_id !== null) {
            $storeName = Store::query()->whereKey($facility->store_id)->value('name') ?? $facility->store_id;
            abort(409, "店舗「{$storeName}」が紐づいているため削除できません。先に店舗側で場所を変更するか、店舗を削除してください。");
        }

        $facility->delete();

        return response()->noContent();
    }

    private function serialize(MapFacilities $facility, ?Store $store = null): array
    {
        return [
            'id' => (string) $facility->id,
            'store_id' => $facility->store_id,
            'store_name' => $store?->name,
            'store_visible' => $store ? (bool) ($store->is_visible ?? true) : null,
            'name' => $facility->name,
            'type' => $facility->type,
            'floor' => (int) $facility->floor,
            'x' => (int) $facility->x,
            'y' => (int) $facility->y,
        ];
    }

    private function authorizeAdmin(Request $request): void
    {
        if (config('admin.public_access')) {
            return;
        }

        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }
}
