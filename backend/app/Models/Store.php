<?php

namespace App\Models;

use App\Support\DbSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Store extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $attributes = [
        'ticket_limit' => 20,
    ];

    protected $fillable = [
        'id',
        'name',
        'description',
        'ticket_prefix',
        'ticket_limit',
        'disabled_ticket_numbers',
        'is_open',
        'is_visible',
        'exhibition_day',
        'show_on_monitor',
        'show_on_call_page',
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
        'show_on_call_page' => 'boolean',
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

    /** 今日の出展日（day1/day2）に合う店舗だけに絞る。both も含む */
    public function scopeForCurrentFestivalDay(Builder $query, ?string $day = null): Builder
    {
        if (! DbSchema::hasColumn($this->getTable(), 'exhibition_day')) {
            return $query;
        }

        $current = $day ?? FestivalSetting::currentDay();

        return $query->where(function (Builder $inner) use ($current) {
            $inner->where('exhibition_day', $current)
                ->orWhere('exhibition_day', FestivalSetting::DAY_BOTH);
        });
    }

    /** 本番でマイグレーション未適用でも、整理券の既定を20にし、旧既定の50を直す */
    public static function ensureTicketLimitDefault(): void
    {
        static $done = false;
        if ($done) {
            return;
        }
        $done = true;

        if (! DbSchema::hasColumn((new static)->getTable(), 'ticket_limit')) {
            return;
        }

        try {
            if (Cache::get('ticket_limit_default_20_applied')) {
                return;
            }

            $driver = Schema::getConnection()->getDriverName();
            if (in_array($driver, ['mysql', 'mariadb'], true)) {
                DB::statement('ALTER TABLE stores MODIFY ticket_limit INT UNSIGNED NOT NULL DEFAULT 20');
            } elseif ($driver === 'pgsql') {
                DB::statement('ALTER TABLE stores ALTER COLUMN ticket_limit SET DEFAULT 20');
            }

            DB::table('stores')->where('ticket_limit', 50)->update(['ticket_limit' => 20]);
            Cache::forever('ticket_limit_default_20_applied', true);
        } catch (\Throwable) {
            try {
                DB::table('stores')->where('ticket_limit', 50)->update(['ticket_limit' => 20]);
                Cache::forever('ticket_limit_default_20_applied', true);
            } catch (\Throwable) {
                // 権限がない／列が無いときは、保存済みの値のままにする
            }
        }
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
            DbSchema::flush();
        } catch (\Throwable $exception) {
            DbSchema::flush();
            if (self::hasShowOnMonitorColumn()) {
                return;
            }

            throw $exception;
        }
    }

    public static function hasShowOnMonitorColumn(): bool
    {
        try {
            return DbSchema::hasColumn((new static)->getTable(), 'show_on_monitor');
        } catch (\Throwable) {
            return false;
        }
    }

    /** 本番でマイグレーション未適用でも、受取番号ページの表示列だけ先に用意する */
    public static function ensureShowOnCallPageColumn(): void
    {
        if (self::hasShowOnCallPageColumn()) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        try {
            if ($driver === 'pgsql') {
                DB::statement('ALTER TABLE stores ADD COLUMN IF NOT EXISTS show_on_call_page BOOLEAN NOT NULL DEFAULT FALSE');
            } elseif (in_array($driver, ['mysql', 'mariadb'], true)) {
                DB::statement('ALTER TABLE stores ADD COLUMN show_on_call_page TINYINT(1) NOT NULL DEFAULT 0');
            } else {
                Schema::table('stores', function (Blueprint $table) {
                    $table->boolean('show_on_call_page')->default(false);
                });
            }
            DbSchema::flush();
        } catch (\Throwable $exception) {
            DbSchema::flush();
            if (! self::hasShowOnCallPageColumn()) {
                throw $exception;
            }
        }

        // 列を足した直後だけ。フードは今まで受取番号ページに出ていたので、そのまま出す
        self::backfillShowOnCallPageForFood();
    }

    public static function hasShowOnCallPageColumn(): bool
    {
        try {
            return DbSchema::hasColumn((new static)->getTable(), 'show_on_call_page');
        } catch (\Throwable) {
            return false;
        }
    }

    /** すでに出店しているフードを、受取番号ページに出したままにする */
    public static function backfillShowOnCallPageForFood(): void
    {
        if (! self::hasShowOnCallPageColumn() || ! Schema::hasTable('map_facilities')) {
            return;
        }

        $ids = DB::table('map_facilities')
            ->whereIn('type', ['food', 'フード', '飲食ブース'])
            ->whereNotNull('store_id')
            ->pluck('store_id');

        if ($ids->isEmpty()) {
            return;
        }

        DB::table('stores')->whereIn('id', $ids)->update(['show_on_call_page' => true]);
    }

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

        DbSchema::flush();
    }

    public static function hasCrowdLevelColumn(): bool
    {
        try {
            return (bool) DbSchema::remember('stores:crowd_level', function (): bool {
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
                    return DbSchema::hasColumn($table, 'crowd_level');
                }

                return $present !== null;
            });
        } catch (\Throwable) {
            return false;
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
