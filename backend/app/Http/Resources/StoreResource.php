<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StoreResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'is_open' => (bool) $this->is_open,
            'is_visible' => (bool) ($this->is_visible ?? true),
            'current_wait_min' => (int) $this->current_wait_min,
            'current_queue_count' => (int) $this->current_queue_count,
            'wait_time' => (int) $this->current_wait_min,
            'wait_display_mode' => $this->wait_display_mode ?? 'minutes',
            'wait_display_text' => $this->wait_display_text,
            'map_facility_id' => $this->relationLoaded('mapFacility')
                ? ($this->mapFacility?->id !== null ? (string) $this->mapFacility->id : null)
                : null,
        ];

        if ($this->relationLoaded('menuItems')) {
            $data['menu_items'] = $this->menuItems->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'description' => $item->description,
                'price' => (int) $item->price,
                'is_available' => (bool) $item->is_available,
            ])->values();
        }

        if ($this->relationLoaded('orders')) {
            $data['ticket_numbers'] = $this->orders
                ->pluck('ticket_number')
                ->values();
        }

        return [
            ...$data,
            'type' => 'stores',
            'attributes' => $data,
        ];
    }
}
