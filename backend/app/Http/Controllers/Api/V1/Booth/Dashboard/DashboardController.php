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
        //
    }

    public function destroy(string $id)
    {
        //
    }
}
