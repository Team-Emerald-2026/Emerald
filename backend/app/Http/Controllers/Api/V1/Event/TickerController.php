<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use App\Models\EventNotice;

class TickerController extends Controller
{
    /**
     * ホームの電光掲示板に、いま流すお知らせ。
     * 時刻の判定はサーバー側で行う（来場者の端末の時計がずれていても影響しない）。
     */
    public function index()
    {
        $now = now();

        $items = EventNotice::query()
            ->published()
            ->whereNotNull('starts_at')
            ->whereNotNull('ticker_lead_minutes')
            ->get()
            ->filter(fn (EventNotice $notice) => $notice->isTickerActiveAt($now))
            ->sortBy('starts_at')
            ->values()
            ->map(fn (EventNotice $notice) => [
                'id' => (string) $notice->id,
                'title' => $notice->title,
                'body' => $notice->body,
                'starts_at' => $notice->starts_at->toISOString(),
            ]);

        return response()->json(['data' => $items], 200, [], JSON_UNESCAPED_UNICODE);
    }
}
