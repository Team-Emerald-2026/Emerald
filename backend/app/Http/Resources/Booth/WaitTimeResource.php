<?php

namespace App\Http\Resources\Booth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WaitTimeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'current_wait_min' => (int) $this->current_wait_min,
            'current_queue_count' => (int) $this->current_queue_count,
            'wait_display_mode' => $this->wait_display_mode ?? 'minutes',
            'wait_display_text' => $this->wait_display_text,
            'updated_at' => optional($this->updated_at)->toISOString(),
        ];
    }
}
