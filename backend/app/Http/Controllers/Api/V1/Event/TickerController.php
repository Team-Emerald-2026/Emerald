<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use App\Models\EventNotice;
use Illuminate\Support\Facades\Cache;

class TickerController extends Controller
{
    /**
     * ホームの電光掲示板に、いま流すお知らせ。
     * 時刻の判定はサーバー側で行う（来場者の端末の時計がずれていても影響しない）。
     * 「すぐ流す」お知らせを先に（新しく流し始めたものから）、続けてイベントを開始時刻順に並べる。
     */
    public function index()
    {
        EventNotice::ensureTickerStartedAtColumn();

        // ホームを開いた全員が同じ内容を見るため、短時間キャッシュしてDB負荷を抑える
        // （秒数は config/cache.php の api_list_ttl。0でキャッシュ無効）
        $items = Cache::remember(EventNotice::TICKER_CACHE_KEY, config('cache.api_list_ttl'), fn () => $this->activeItems());

        return response()->json(['data' => $items], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function activeItems(): array
    {
        $now = now();

        $active = EventNotice::query()
            ->with('mapFacility')
            ->published()
            ->where(function ($query) {
                $query
                    ->where(fn ($q) => $q->where('type', 'notice')->whereNotNull('ticker_started_at'))
                    ->orWhere(fn ($q) => $q->where('type', '!=', 'notice')->whereNotNull('starts_at')->whereNotNull('ticker_lead_minutes'));
            })
            ->get()
            ->filter(fn (EventNotice $notice) => $notice->isTickerActiveAt($now));

        $notices = $active->where('type', 'notice')->sortByDesc('ticker_started_at');
        $events = $active->where('type', '!=', 'notice')->sortBy('starts_at');

        return $notices->concat($events)
            ->values()
            ->map(fn (EventNotice $notice) => [
                'id' => (string) $notice->id,
                'title' => $notice->title,
                'body' => $notice->body,
                // お知らせは時刻・場所を出さない
                'starts_at' => $notice->type === 'notice' ? null : $notice->starts_at->toISOString(),
                'ends_at' => $notice->type === 'notice' ? null : $notice->ends_at?->toISOString(),
                'location' => $notice->type === 'notice' ? null : $notice->locationLabel(),
            ])
            ->all();
    }
}
