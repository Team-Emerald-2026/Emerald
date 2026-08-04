<?php

namespace App\Http\Resources\Booth\Accounting;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\JsonApi\JsonApiResource;

class OrderResource extends JsonApiResource
{
    /**
     * The resource's attributes.
     */
    public $attributes = [
        'ticket_number',
        'total_price',
        'status',
        'ordered_at',
        'called_at',
        'served_at',
        'settled_at',
        'items',
    ];

    public function toAttributes(Request $request): array
    {
        return [
            'ticket_number' => $this->resource->ticket_number,
            'total_price' => $this->resource->total_price,
            'status' => $this->resource->status,
            'ordered_at' => optional($this->resource->ordered_at)->toISOString(),
            'called_at' => optional($this->resource->called_at)->toISOString(),
            'served_at' => optional($this->resource->served_at)->toISOString(),
            'settled_at' => optional($this->resource->settled_at)->toISOString(),
            'items' => $this->resource->relationLoaded('items')
                ? $this->resource->items->map(function ($item) {
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
    }
}
