<?php

namespace App\Http\Resources\Booth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\JsonApi\JsonApiResource;

class DashboardResource extends JsonApiResource
{
    /**
     * The resource's attributes.
     */
    public $attributes = [
        'name',
        'description',
        'ticket_prefix',
        'is_open',
        'current_wait_min',
        'current_queue_count',
    ];

    /**
     * The resource's relationships.
     */
    public $relationships = [
        // ...
    ];

    public function toAttributes(Request $request): array
    {
        return [
            'name' => $this->resource->name,
            'description' => $this->resource->description,
            'ticket_prefix' => $this->resource->ticket_prefix,
            'is_open' => $this->resource->is_open,
            'current_wait_min' => $this->resource->current_wait_min,
            'current_queue_count' => $this->resource->current_queue_count,
        ];
    }
}
