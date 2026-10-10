<?php

namespace App\Http\Controllers\Api\V1\Map;

use App\Http\Controllers\Controller;
use App\Http\Resources\MapFacilityResource;
use App\Models\MapFacilities;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

class FacilityController extends Controller
{
    public function index(): JsonResponse
    {
        // 場所の名前（部屋番号など）。店舗が入った枠でも、同じ位置にある空き枠の名前を引けるようにする
        $slotLabels = MapFacilities::slotLabels();

        $facilities = MapFacilities::query()
            ->leftJoin('stores', 'map_facilities.store_id', '=', 'stores.id')
            ->when(Schema::hasColumn('stores', 'is_visible'), function ($query) {
                $query->where(function ($inner) {
                    $inner->whereNull('map_facilities.store_id')
                        ->orWhere('stores.is_visible', true);
                });
            })
            ->select([
                'map_facilities.id',
                'map_facilities.store_id',
                'map_facilities.name',
                'map_facilities.type',
                'map_facilities.floor',
                'map_facilities.x',
                'map_facilities.y',
            ])
            ->orderByRaw('map_facilities.store_id is null')
            ->orderBy('map_facilities.id')
            ->get()
            ->unique(function ($facility) {
                return $facility->floor . ':' . (int) $facility->x . ':' . (int) $facility->y;
            })
            ->values()
            ->each(function ($facility) use ($slotLabels) {
                $facility->setAttribute(
                    'label',
                    $facility->store_id === null
                        ? $facility->name
                        : ($slotLabels[MapFacilities::positionKey($facility->floor, $facility->x, $facility->y)] ?? null),
                );
            });

        return MapFacilityResource::collection($facilities)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }
}
