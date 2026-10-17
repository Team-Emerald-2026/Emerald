<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Store extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'description',
        'ticket_prefix',
        'ticket_limit',
        'disabled_ticket_numbers',
        'is_open',
        'is_visible',
        'show_on_monitor',
        'current_wait_min',
        'current_queue_count',
        'wait_display_mode',
        'wait_display_text',
        'crowd_level',
    ];

    protected $casts = [
        'is_open' => 'boolean',
        'is_visible' => 'boolean',
        'show_on_monitor' => 'boolean',
        'current_wait_min' => 'integer',
        'current_queue_count' => 'integer',
        'ticket_limit' => 'integer',
        'disabled_ticket_numbers' => 'array',
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

    /** 本番でマイグレーション未適用でも、モニター表示列だけ先に用意する */
    public static function ensureShowOnMonitorColumn(): void
    {
        if (self::hasShowOnMonitorColumn()) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        try {
            if ($driver === 'pgsql') {
                DB::statement('ALTER TABLE stores ADD COLUMN IF NOT EXISTS show_on_monitor BOOLEAN NOT NULL DEFAULT FALSE');
            } elseif (in_array($driver, ['mysql', 'mariadb'], true)) {
                DB::statement('ALTER TABLE stores ADD COLUMN show_on_monitor TINYINT(1) NOT NULL DEFAULT 0');
            } else {
                Schema::table('stores', function (Blueprint $table) {
                    $table->boolean('show_on_monitor')->default(false);
                });
            }
        } catch (\Throwable $exception) {
            if (self::hasShowOnMonitorColumn()) {
                return;
            }

            throw $exception;
        }
    }

    public static function hasShowOnMonitorColumn(): bool
    {
        try {
            return Schema::hasColumn((new static)->getTable(), 'show_on_monitor');
        } catch (\Throwable) {
            return false;
        }
    }
}
