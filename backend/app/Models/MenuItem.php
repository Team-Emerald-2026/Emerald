<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class MenuItem extends Model
{
    protected $fillable = [
        'store_id',
        'name',
        'description',
        'price',
        'is_available',
        'is_sold_out',
    ];

    protected $casts = [
        'price' => 'integer',
        'is_available' => 'boolean',
        'is_sold_out' => 'boolean',
    ];

    public function scopeForStore(Builder $query, string $storeId): Builder
    {
        return $query->where('store_id', $storeId);
    }
}
