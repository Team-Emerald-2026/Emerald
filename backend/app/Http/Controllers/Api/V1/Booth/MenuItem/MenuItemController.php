<?php

namespace App\Http\Controllers\Api\V1\Booth\MenuItem;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\MenuItemResource;
use App\Models\MenuItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MenuItemController extends Controller
{
    public function index()
    {
        $items = MenuItem::query()
            ->where('store_id', Auth::user()->store_id)
            ->orderBy('id')
            ->get();

        return MenuItemResource::collection($items)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'integer', 'min:0'],
            'is_available' => ['sometimes', 'boolean'],
        ]);

        $item = MenuItem::query()->create([
            ...$validated,
            'store_id' => Auth::user()->store_id,
            'is_available' => $validated['is_available'] ?? true,
        ]);

        return MenuItemResource::make($item)
            ->response()
            ->setStatusCode(201)
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function update(Request $request, string $id)
    {
        $item = $this->findOwnItem($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['sometimes', 'required', 'integer', 'min:0'],
            'is_available' => ['sometimes', 'boolean'],
        ]);

        $item->fill($validated);
        $item->save();

        return MenuItemResource::make($item)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function destroy(string $id)
    {
        $item = $this->findOwnItem($id);
        $item->delete();

        return response()->noContent();
    }

    private function findOwnItem(string $id): MenuItem
    {
        $item = MenuItem::query()->findOrFail($id);

        if ((string) $item->store_id !== (string) Auth::user()->store_id) {
            abort(403, '他店舗の商品は操作できません。');
        }

        return $item;
    }
}