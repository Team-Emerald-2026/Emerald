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
            // この日の出展時間（空なら一日中）
            'time_slots' => $this->resource->getAttribute('time_slots') ?? [],
        ];

        // 店舗が無い場所は null のままにし、画面側はフードを今まで通り出す
        if (array_key_exists('show_on_call_page', $this->resource->getAttributes())
            && $this->show_on_call_page !== null) {
            $raw = $this->show_on_call_page;
            // MySQL は "0"/"1"、PostgreSQL は t/f や bool で返ることがある
            $data['show_on_call_page'] = in_array($raw, [true, 1, '1', 't', 'true', 'on'], true);
        }

        return [
            ...$data,
            'attributes' => $data,
        ];
    }
}
