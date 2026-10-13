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
        ];

        return [
            ...$data,
            'type' => 'event_notices',
            'attributes' => $data,
        ];
    }
}
