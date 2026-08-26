<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesEntry extends Model
{
    protected $fillable = [
        'store_id',
        'amount',
        'memo',
        'recorded_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'recorded_at' => 'datetime',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function scopeForStore(Builder $query, string $storeId): Builder
    {
        return $query->where('store_id', $storeId);
    }
}
