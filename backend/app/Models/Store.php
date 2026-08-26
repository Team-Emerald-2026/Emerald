<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Store extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'description',
        'ticket_prefix',
        'is_open',
        'is_visible',
        'current_wait_min',
        'current_queue_count',
        'wait_display_mode',
        'wait_display_text',
    ];

    protected $casts = [
        'is_open' => 'boolean',
        'is_visible' => 'boolean',
        'current_wait_min' => 'integer',
        'current_queue_count' => 'integer',
    ];

    public function menuItems(): HasMany
    {
        return $this->hasMany(MenuItem::class, 'store_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'store_id');
    }

    public function mapFacility(): HasOne
    {
        return $this->hasOne(MapFacilities::class, 'store_id');
    }

    public function salesEntries(): HasMany
    {
        return $this->hasMany(SalesEntry::class, 'store_id');
    }
}