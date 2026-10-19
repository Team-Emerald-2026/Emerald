<?php

namespace App\Http\Controllers\Api\V1\Map;

use App\Http\Controllers\Controller;
use App\Http\Resources\MapFacilityResource;
use App\Models\FestivalSetting;
use App\Models\MapFacilities;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class FacilityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'day' => ['nullable', 'string', Rule::in(FestivalSetting::allowedDays())],
        ]);

        // 場所の名前（部屋番号など）。店舗が入った枠でも、同じ位置にある空き枠の名前を引けるようにする
        $slotLabels = MapFacilities::slotLabels();

        $adminCurrentDay = FestivalSetting::currentDay();
        $filterDay = $validated['day'] ?? $adminCurrentDay;

        $facilities = MapFacilities::query()
            ->leftJoin('stores', 'map_facilities.store_id', '=', 'stores.id')
            ->when(Schema::hasColumn('stores', 'is_visible'), function ($query) {
                $query->where(function ($inner) {
                    $inner->whereNull('map_facilities.store_id')
                        ->orWhere('stores.is_visible', true);
                });
            })
            ->when(Schema::hasColumn('stores', 'exhibition_day'), function ($query) use ($filterDay) {
                $query->where(function ($inner) use ($filterDay) {
                    $inner->whereNull('map_facilities.store_id')
                        ->orWhere('stores.exhibition_day', $filterDay)
                        ->orWhere('stores.exhibition_day', FestivalSetting::DAY_BOTH);
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
            ->get();

        // 空き枠は本来いつでも出るが、同じ位置に店舗ピンがあるのに
        // 今日（filterDay）出展の店舗が1件も無いときは出さない。
        // （例: 2日目のみのサークル販売＋部屋枠「6」→ 1日目のマップに「6」だけ残るのを防ぐ）
        // トイレなど店舗ピンが無い枠は、これまで通り両日表示する。
        if (Schema::hasColumn('stores', 'exhibition_day')) {
            $positionsWithAnyStore = [];
            foreach (
                MapFacilities::query()
                    ->whereNotNull('store_id')
                    ->get(['floor', 'x', 'y']) as $row
            ) {
                $positionsWithAnyStore[MapFacilities::positionKey($row->floor, $row->x, $row->y)] = true;
            }

            $positionsWithVisibleStore = [];
            foreach ($facilities as $facility) {
                if ($facility->store_id !== null) {
                    $positionsWithVisibleStore[MapFacilities::positionKey(
                        $facility->floor,
                        $facility->x,
                        $facility->y,
                    )] = true;
                }
            }

            $facilities = $facilities
                ->filter(function ($facility) use ($positionsWithAnyStore, $positionsWithVisibleStore) {
                    if ($facility->store_id !== null) {
                        return true;
                    }

                    $key = MapFacilities::positionKey($facility->floor, $facility->x, $facility->y);

                    return ! isset($positionsWithAnyStore[$key])
                        || isset($positionsWithVisibleStore[$key]);
                })
                ->values();
        }

        $facilities = $facilities
            ->unique(function ($facility) {
                return $facility->floor.':'.(int) $facility->x.':'.(int) $facility->y;
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
            ->additional([
                'meta' => [
                    'current_day' => $adminCurrentDay,
                    'filter_day' => $filterDay,
                ],
            ])
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }
}
