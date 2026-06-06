<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\JsonApi\JsonApiResource;

class StoreResource extends JsonApiResource
{
    /**
     * The resource's attributes.
     */
    public $attributes = [
        'name',
        'description',
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
            'is_open' => $this->resource->is_open,
            'current_wait_min' => $this->resource->current_wait_min,
            'current_queue_count' => $this->resource->current_queue_count,
        ];
    }
}