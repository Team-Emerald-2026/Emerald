<?php

namespace App\Http\Controllers\Api\V1\Map;

use App\Http\Controllers\Controller;
use App\Http\Resources\MapFacilityResource;
use App\Models\MapFacilities;
use Illuminate\Http\JsonResponse;

class FacilityController extends Controller
{
    public function index(): JsonResponse
    {
        $facilities = MapFacilities::query()
            ->join('stores', 'map_facilities.store_id', '=', 'stores.id')
            ->where('stores.is_visible', true)
            ->select([
                'map_facilities.id',
                'map_facilities.store_id',
                'map_facilities.name',
                'map_facilities.type',
                'map_facilities.floor',
                'map_facilities.x',
                'map_facilities.y',
            ])
            ->get();

        return MapFacilityResource::collection($facilities)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }
}
