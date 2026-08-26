<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'id' => (string) $this->id,
            'store_id' => $this->store_id,
            'amount' => (int) $this->amount,
            'memo' => $this->memo,
            'recorded_at' => optional($this->recorded_at)->toISOString(),
        ];

        return [
            ...$data,
            'type' => 'sales_entries',
            'attributes' => $data,
        ];
    }
}
