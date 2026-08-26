<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use App\Http\Resources\EventNoticeResource;
use App\Models\EventNotice;

class EventController extends Controller
{
    public function index()
    {
        $events = EventNotice::query()
            ->published()
            ->visibleAt()
            ->orderByRaw('starts_at is null')
            ->orderBy('starts_at')
            ->orderBy('id')
            ->get();

        return EventNoticeResource::collection($events)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function show(string $id)
    {
        $event = EventNotice::query()
            ->published()
            ->visibleAt()
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
