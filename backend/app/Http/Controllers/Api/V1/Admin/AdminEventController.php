<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\EventNoticeResource;
use App\Models\EventNotice;
use Illuminate\Http\Request;

class AdminEventController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $events = EventNotice::query()
            ->with('mapFacility')
            ->orderByDesc('id')
            ->get();

        return EventNoticeResource::collection($events)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        EventNotice::ensureTickerStartedAtColumn();

        [$data, $tickerNow] = $this->validated($request);
        $event = new EventNotice($data);
        $this->applyNoticeTicker($event, $tickerNow);
        $event->save();

        return EventNoticeResource::make($event->load('mapFacility'))
            ->response()
            ->setStatusCode(201)
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function show(Request $request, string $id)
    {
        $this->authorizeAdmin($request);

        return EventNoticeResource::make(EventNotice::query()->findOrFail($id))
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function update(Request $request, string $id)
    {
        $this->authorizeAdmin($request);
        EventNotice::ensureTickerStartedAtColumn();

        $event = EventNotice::query()->findOrFail($id);
        [$data, $tickerNow] = $this->validated($request, false);
        $event->fill($data);
        $this->applyNoticeTicker($event, $tickerNow);
        $event->save();

        return EventNoticeResource::make($event->refresh()->load('mapFacility'))
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function destroy(Request $request, string $id)
    {
        $this->authorizeAdmin($request);

        EventNotice::query()->findOrFail($id)->delete();

        return response()->json(null, 204);
    }

    /**
     * お知らせを掲示板に「すぐ流す」設定を反映する。
     * 流していない（または流す時間が終わった）お知らせを流すときは、いまから流し始める。
     * すでに流している途中なら、文面を直して保存しても流し始めた時刻は変えない。
     */
    private function applyNoticeTicker(EventNotice $event, ?bool $tickerNow): void
    {
        if ($event->type !== 'notice') {
            $event->ticker_started_at = null;

            return;
        }

        // お知らせには「開始の何分前から」はない
        $event->ticker_lead_minutes = null;

        if ($tickerNow === null) {
            return;
        }

        if (! $tickerNow) {
            $event->ticker_started_at = null;
        } elseif (! $event->isTickerActiveAt()) {
            $event->ticker_started_at = now();
        }
    }

    /**
     * @return array{0: array<string, mixed>, 1: ?bool} [保存する値, 掲示板にすぐ流すか（未指定は null）]
     */
    private function validated(Request $request, bool $creating = true): array
    {
        $required = $creating ? 'required' : 'sometimes';

        $data = $request->validate([
            'title' => [$required, 'string', 'max:255'],
            // 内容は任意。空・未指定のときは空文字で保存する（DB は NOT NULL）
            'body' => ['nullable', 'string', 'max:5000'],
            'type' => [$required, 'string', 'in:event,notice'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_published' => ['sometimes', 'boolean'],
            // 開催場所（校内マップの部屋）。null なら場所なし
            'map_facility_id' => ['nullable', 'integer', 'exists:map_facilities,id'],
            // 電光掲示板に流す設定。ticker_lead_minutes が null なら流さない
            'ticker_lead_minutes' => ['nullable', 'integer', 'min:0', 'max:180'],
            'ticker_after_minutes' => ['nullable', 'integer', 'min:0', 'max:180'],
            // お知らせを電光掲示板にすぐ流すか。流す時間は ticker_after_minutes（null なら止めるまで）
            'ticker_now' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('body', $data)) {
            $data['body'] = $data['body'] ?? '';
        } elseif ($creating) {
            $data['body'] = '';
        }

        $tickerNow = array_key_exists('ticker_now', $data) ? (bool) $data['ticker_now'] : null;
        unset($data['ticker_now']);

        return [$data, $tickerNow];
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }
}
