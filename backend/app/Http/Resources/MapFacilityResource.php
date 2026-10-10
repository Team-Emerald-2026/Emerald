<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MapFacilityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'store_id' => $this->store_id,
            'name' => $this->name,
            'type' => $this->type,
            'floor' => (int) $this->floor,
            'x' => (int) $this->x,
            'y' => (int) $this->y,
            // 場所の名前（部屋番号など）。店舗が入った枠でも、同じ位置の空き枠の名前が入る
            'label' => $this->resource->getAttribute('label'),
        ];

        return [
            ...$data,
            'attributes' => $data,
        ];
    }
}
