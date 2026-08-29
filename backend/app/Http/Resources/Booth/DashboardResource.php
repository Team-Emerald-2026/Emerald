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
