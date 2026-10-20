<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use App\Http\Resources\EventNoticeResource;
use App\Models\EventNotice;
use Illuminate\Support\Facades\Cache;

class EventController extends Controller
{
    public function index()
    {
        // 全員が同じ一覧を見るため、短時間キャッシュしてDB負荷を抑える
        // （秒数は config/cache.php の api_list_ttl。0でキャッシュ無効）
        $payload = Cache::remember(EventNotice::EVENTS_CACHE_KEY, config('cache.api_list_ttl'), function () {
            $events = EventNotice::query()
                ->with('mapFacility')
                ->published()
                ->orderByRaw('starts_at is null')
                ->orderBy('starts_at')
                ->orderBy('id')
                ->get();

            return EventNoticeResource::collection($events)->resolve();
        });

        return response()->json(['data' => $payload], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public function show(string $id)
    {
        $event = EventNotice::query()
            ->published()
            ->find($id);

        if (! $event) {
            return response()->json([
                'error' => [
                    'code' => 'NOT_FOUND',
                    'message' => '指定したイベントが見つかりません',
                    'details' => ['field' => 'id'],
                ],
            ], 404, [], JSON_UNESCAPED_UNICODE);
        }

        return EventNoticeResource::make($event)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }
}
