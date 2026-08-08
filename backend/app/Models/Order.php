<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'store_id',
        'ticket_number',
        'total_price',
        'status',
        'ordered_at',
        'called_at',
        'served_at',
        'settled_at',
    ];

    protected $casts = [
        'total_price' => 'integer',
        'ordered_at' => 'datetime',
        'called_at' => 'datetime',
        'served_at' => 'datetime',
        'settled_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function scopeForStore(Builder $query, string $storeId): Builder
    {
        return $query->where('store_id', $storeId);
    }
}
