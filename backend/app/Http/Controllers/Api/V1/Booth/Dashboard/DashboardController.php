<?php

namespace App\Http\Controllers\Api\V1\Booth\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booth\DashboardResource;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index()
    {
        $stores = Store::query()
            ->select([
                'id',
                'name',
                'description',
                'ticket_prefix',
                'is_open',
                'current_wait_min',
                'current_queue_count'])
            ->findOrFail(Auth::user()->store_id);

        return DashboardResource::make($stores)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function store(Request $request)
    {
        //
    }

    public function show(string $id)
    {
        //
    }

    public function update(Request $request, string $id)
{
    $user = Auth::user();

    if ((string) $user->store_id !== (string) $id) {
        abort(403, '他店舗の情報は更新できません。');
    }

    $validated = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'description' => ['required', 'string', 'max:1000'],
        'is_open' => ['required', 'boolean'],
    ]);

    $store = Store::query()->findOrFail($user->store_id);
    $store->fill($validated);
    $store->save();

    return DashboardResource::make($store)
        ->response()
        ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
}

    public function destroy(string $id)
    {
        //
    }
}
