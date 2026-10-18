<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Schema;

class Order extends Model
{
    protected $fillable = [
        'store_id',
        'festival_day',
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

    protected static function booted(): void
    {
        static::creating(function (Order $order): void {
            if (filled($order->festival_day)) {
                return;
            }
            if (! Schema::hasColumn($order->getTable(), 'festival_day')) {
                return;
            }

            // 会計を取ったときの開催日。あとから 1日目 / 2日目 に分ける。
            $order->festival_day = FestivalSetting::currentDay();
        });
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function scopeForStore(Builder $query, string $storeId): Builder
    {
        return $query->where('store_id', $storeId);
    }

    public function scopeCurrentlyCalled(Builder $query): Builder
    {
        return $query
            ->whereNotNull('called_at')
            ->whereNull('served_at')
            ->where('status', '!=', 'canceled');
    }

    public function scopeWaiting(Builder $query): Builder
    {
        return $query
            ->whereNull('served_at')
            ->where('status', '!=', 'canceled');
    }
}
