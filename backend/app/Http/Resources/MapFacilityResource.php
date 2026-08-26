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
        ];

        return [
            ...$data,
            'attributes' => $data,
        ];
    }
}
