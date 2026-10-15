<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventNoticeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'id' => (string) $this->id,
            'title' => $this->title,
            'body' => $this->body,
            'type' => $this->type,
            'starts_at' => optional($this->starts_at)->toISOString(),
            'ends_at' => optional($this->ends_at)->toISOString(),
            'is_published' => (bool) $this->is_published,
            'ticker_lead_minutes' => $this->ticker_lead_minutes,
            'ticker_after_minutes' => $this->ticker_after_minutes,
            'ticker_started_at' => optional($this->ticker_started_at)->toISOString(),
            // いま電光掲示板に流しているか
            'ticker_active' => $this->resource->isTickerActiveAt(),
            // お知らせを登録した時刻（ホームのお知らせ一覧で「お知らせした時間」として表示）
            'created_at' => optional($this->created_at)->toISOString(),
        ];

        return [
            ...$data,
            'type' => 'event_notices',
            'attributes' => $data,
        ];
    }
}
