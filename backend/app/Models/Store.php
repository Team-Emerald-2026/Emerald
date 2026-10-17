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

    private static ?bool $hasCrowdLevelColumn = null;

    /** 本番でマイグレーション未適用でも、店内混雑列だけ先に用意する */
    public static function ensureCrowdLevelColumn(): void
    {
        if (self::hasCrowdLevelColumn()) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        try {
            if ($driver === 'pgsql') {
                DB::statement('ALTER TABLE stores ADD COLUMN IF NOT EXISTS crowd_level VARCHAR(16) NULL');
            } elseif (in_array($driver, ['mysql', 'mariadb'], true)) {
                DB::statement('ALTER TABLE stores ADD COLUMN crowd_level VARCHAR(16) NULL');
            } else {
                Schema::table('stores', function (Blueprint $table) {
                    $table->string('crowd_level', 16)->nullable();
                });
            }
        } catch (\Throwable) {
            // 既にある／権限がないときは、wait_display_text の退避に回す
        }

        self::$hasCrowdLevelColumn = null;
        self::hasCrowdLevelColumn();
    }

    public static function hasCrowdLevelColumn(): bool
    {
        if (self::$hasCrowdLevelColumn !== null) {
            return self::$hasCrowdLevelColumn;
        }

        try {
            $table = (new static)->getTable();
            $connection = Schema::getConnection();
            $driver = $connection->getDriverName();

            if ($driver === 'pgsql') {
                $present = $connection->selectOne(
                    'select 1 as present from information_schema.columns where table_schema = current_schema() and table_name = ? and column_name = ? limit 1',
                    [$table, 'crowd_level']
                );
            } elseif (in_array($driver, ['mysql', 'mariadb'], true)) {
                $present = $connection->selectOne(
                    'select 1 as present from information_schema.columns where table_schema = ? and table_name = ? and column_name = ? limit 1',
                    [$connection->getDatabaseName(), $table, 'crowd_level']
                );
            } else {
                return self::$hasCrowdLevelColumn = Schema::hasColumn($table, 'crowd_level');
            }

            return self::$hasCrowdLevelColumn = $present !== null;
        } catch (\Throwable) {
            return self::$hasCrowdLevelColumn = false;
        }
    }

    public const CROWD_TEXT_PREFIX = '__crowd__:';

    public static function parseCrowdLevelValue(mixed $crowdLevel, mixed $waitDisplayText): ?string
    {
        $allowed = ['empty', 'moderate', 'crowded'];
        if (is_string($crowdLevel) && in_array($crowdLevel, $allowed, true)) {
            return $crowdLevel;
        }

        $text = is_string($waitDisplayText) ? trim($waitDisplayText) : '';
        if (str_starts_with($text, self::CROWD_TEXT_PREFIX)) {
            $fromText = substr($text, strlen(self::CROWD_TEXT_PREFIX));

            return in_array($fromText, $allowed, true) ? $fromText : null;
        }

        return null;
    }

    public function resolvedCrowdLevel(): ?string
    {
        return self::parseCrowdLevelValue($this->crowd_level ?? null, $this->wait_display_text ?? null);
    }
}
