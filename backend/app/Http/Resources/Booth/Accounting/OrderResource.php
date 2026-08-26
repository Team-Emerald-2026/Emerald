<?php

namespace App\Http\Resources\Booth\Accounting;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'ticket_number' => $this->ticket_number,
            'total_price' => $this->total_price,
            'status' => $this->status,
            'ordered_at' => optional($this->ordered_at)->toISOString(),
            'called_at' => optional($this->called_at)->toISOString(),
            'served_at' => optional($this->served_at)->toISOString(),
            'settled_at' => optional($this->settled_at)->toISOString(),
            'items' => $this->relationLoaded('items')
                ? $this->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'menu_item_id' => $item->menu_item_id,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'subtotal' => $item->subtotal,
                    ];
                })->values()
                : [],
        ];

        return [
            ...$data,
            'type' => 'orders',
            'attributes' => $data,
        ];
    }
}
