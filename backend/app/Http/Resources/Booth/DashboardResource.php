<?php

namespace App\Http\Resources\Booth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DashboardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'is_open' => (bool) $this->is_open,
            'current_wait_min' => (int) $this->current_wait_min,
            'current_queue_count' => (int) $this->current_queue_count,
            'wait_display_mode' => $this->wait_display_mode ?? 'minutes',
            'wait_display_text' => $this->wait_display_text,
            'crowd_level' => $this->crowd_level,
            'ticket_limit' => (int) ($this->ticket_limit ?? 50),
            'disabled_ticket_numbers' => collect($this->disabled_ticket_numbers ?? [])
                ->map(fn ($number) => (int) $number)
                ->values()
                ->all(),
            'revenue' => (int) ($this->revenue ?? 0),
            'type' => $this->boothType(),
        ];

        return [
            ...$data,
            'type' => 'stores',
            'attributes' => $data,
        ];
    }

    private function boothType(): string
    {
        $facilityType = $this->resource->relationLoaded('mapFacility')
            ? $this->resource->mapFacility?->type
            : null;

        return is_string($facilityType) && $facilityType !== '' ? $facilityType : 'booth';
    }
}
