<?php

namespace App\Http\Controllers\Api\V1\Map;

use App\Http\Controllers\Controller;
use App\Http\Resources\MapFacilityResource;
use App\Models\FestivalSetting;
use App\Models\MapFacilities;
use App\Models\Store;
use App\Support\BoothSchedule;
use App\Support\DbSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

class FacilityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Store::ensureShowOnCallPageColumn();

        $validated = $request->validate([
            'day' => ['nullable', 'string', Rule::in(FestivalSetting::allowedDays())],
        ]);

        $adminCurrentDay = FestivalSetting::currentDay();
        $filterDay = $validated['day'] ?? $adminCurrentDay;

        // 全員が同じ地図を見るため、短時間キャッシュしてDB負荷を抑える
        // （秒数は config/cache.php の api_list_ttl。0でキャッシュ無効）
        $payload = Cache::remember(
            'api:v1:map:facilities:'.$filterDay,
            config('cache.api_list_ttl'),
            fn () => MapFacilityResource::collection($this->facilitiesFor($filterDay))->resolve(),
        );

        return response()->json([
            'data' => $payload,
            'meta' => [
                'current_day' => $adminCurrentDay,
                'filter_day' => $filterDay,
            ],
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function facilitiesFor(string $filterDay): Collection
    {
        // 場所の名前（部屋番号など）。店舗が入った枠でも、同じ位置にある空き枠の名前を引けるようにする
        $slotLabels = MapFacilities::slotLabels();

        $facilities = MapFacilities::query()
            ->leftJoin('stores', 'map_facilities.store_id', '=', 'stores.id')
            ->when(DbSchema::hasColumn('stores', 'is_visible'), function ($query) {
                $query->where(function ($inner) {
                    $inner->whereNull('map_facilities.store_id')
                        ->orWhere('stores.is_visible', true);
                });
            })
            ->when(DbSchema::hasColumn('stores', 'exhibition_day'), function ($query) use ($filterDay) {
                $query->where(function ($inner) use ($filterDay) {
                    $inner->whereNull('map_facilities.store_id')
                        ->orWhere('stores.exhibition_day', $filterDay)
                        ->orWhere('stores.exhibition_day', FestivalSetting::DAY_BOTH);
                });
            })
            ->select(array_values(array_filter([
                'map_facilities.id',
                'map_facilities.store_id',
                'map_facilities.name',
                'map_facilities.type',
                'map_facilities.floor',
                'map_facilities.x',
                'map_facilities.y',
                DbSchema::hasColumn('stores', 'show_on_call_page') ? 'stores.show_on_call_page' : null,
                DbSchema::hasColumn('stores', 'time_slots') ? 'stores.time_slots as store_time_slots' : null,
            ])))
            ->orderByRaw('map_facilities.store_id is null')
            ->orderBy('map_facilities.id')
            ->get();

        // 出展時間がある店舗は、その日の時間帯だけに絞る。その日に時間帯が無ければ出さない
        $facilities = $facilities
            ->filter(function ($facility) use ($filterDay) {
                $raw = $facility->getAttribute('store_time_slots');
                $facility->offsetUnset('store_time_slots');
                $slots = $facility->store_id === null ? [] : BoothSchedule::slotsForDay($raw, $filterDay);
                $facility->setAttribute('time_slots', $slots);

                return $facility->store_id === null
                    || BoothSchedule::decode($raw) === []
                    || $slots !== [];
            })
            ->values();

        // 空き枠は本来いつでも出るが、同じ位置に店舗ピンがあるのに
        // 今日（filterDay）出展の店舗が1件も無いときは出さない。
        // （例: 2日目のみのサークル販売＋部屋枠「6」→ 1日目のマップに「6」だけ残るのを防ぐ）
        // トイレなど店舗ピンが無い枠は、これまで通り両日表示する。
        if (DbSchema::hasColumn('stores', 'exhibition_day')) {
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

        // 同じ位置に複数のブースがあるときは、その日のブースを全部返す（同じ教室の中は開始時刻の順）。
        // 部屋番号だけの空き枠は、同じ位置にブースがあるときだけ隠す。
        // 時間で入れ替わる教室のピンをどれにするかは、画面側で今の時刻から決める。
        return $facilities
            ->groupBy(fn ($facility) => MapFacilities::positionKey($facility->floor, $facility->x, $facility->y))
            ->flatMap(function ($group) {
                $stores = $group->filter(fn ($facility) => $facility->store_id !== null)
                    ->sortBy(fn ($facility) => $facility->time_slots[0]['start'] ?? '')
                    ->values();

                return $stores->isNotEmpty() ? $stores : $group->take(1);
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
    }
}
