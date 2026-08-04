<?php

namespace App\Http\Resources\Booth\Accounting;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\JsonApi\JsonApiResource;

class MenuItemResource extends JsonApiResource
{
    /**
     * The resource's attributes.
     */
    public $attributes = [
        'name',
        'description',
        'price',
        'is_available',
    ];

    public function toAttributes(Request $request): array
    {
        return [
            'name' => $this->resource->name,
            'description' => $this->resource->description,
            'price' => $this->resource->price,
            'is_available' => $this->resource->is_available,
        ];
    }
}
