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
            'exhibition_day' => $this->exhibition_day ?? 'both',
            // 1人当たりの待ち時間（分）
            'current_wait_min' => (int) $this->current_wait_min,
            'current_queue_count' => (int) $this->current_queue_count,
            // 合計の待ち時間の目安（分） = 待ち人数 × 1人当たりの分数。
            // 文字表示モード（wait_display_mode = 'text'）のときは、画面側で wait_display_text を優先して表示する。
            'estimated_wait_min' => (int) $this->current_queue_count * (int) $this->current_wait_min,
            'wait_time' => (int) $this->current_wait_min,
            'wait_display_mode' => $this->wait_display_mode ?? 'minutes',
            'wait_display_text' => $this->wait_display_text,
            'crowd_level' => $this->resource->resolvedCrowdLevel(),
            'map_facility_id' => $this->relationLoaded('mapFacility')
                ? ($this->mapFacility?->id !== null ? (string) $this->mapFacility->id : null)
                : null,
        ];

        // 列を読んでいない古いキャッシュではキーを出さない。画面はフードを今まで通り出す
        if (array_key_exists('show_on_call_page', $this->resource->getAttributes())) {
            $data['show_on_call_page'] = (bool) $this->show_on_call_page;
        }

        if ($this->relationLoaded('menuItems')) {
            // Collection のままキャッシュすると、DB保存時に壊れ、
            // 再取得で配列ではなくなり画面の .map が落ちる。配列にして返す。
            $data['menu_items'] = $this->menuItems->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'description' => $item->description,
                'price' => (int) $item->price,
                'is_available' => (bool) $item->is_available,
                'is_sold_out' => (bool) $item->is_sold_out,
            ])->values()->all();
        }

        if ($this->relationLoaded('orders')) {
            $data['ticket_numbers'] = $this->orders
                ->pluck('ticket_number')
                ->values()
                ->all();
        }

        // 呼び出し画面は type=food で絞る。地図施設の種別を返す（無いときは booth）
        $facilityType = $this->relationLoaded('mapFacility')
            ? ($this->mapFacility?->type ?? 'booth')
            : 'booth';

        return [
            ...$data,
            'type' => $facilityType,
            'attributes' => $data,
        ];
    }
}
