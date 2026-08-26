<?php

namespace App\Http\Resources\Booth\Accounting;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MenuItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'price' => $this->price,
            'is_available' => (bool) $this->is_available,
        ];

        return [
            ...$data,
            'type' => 'menu-items',
            'attributes' => $data,
        ];
    }
}
