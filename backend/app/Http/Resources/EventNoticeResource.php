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
        ];

        return [
            ...$data,
            'type' => 'event_notices',
            'attributes' => $data,
        ];
    }
}
