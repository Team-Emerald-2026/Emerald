<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class FestivalSetting extends Model
{
    public const KEY_CURRENT_DAY = 'current_day';

    public const DAY_1 = 'day1';

    public const DAY_2 = 'day2';

    public const DAY_BOTH = 'both';

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'key',
        'value',
    ];

    /** @return list<string> */
    public static function allowedDays(): array
    {
        return [self::DAY_1, self::DAY_2];
    }

    /** @return list<string> */
    public static function allowedExhibitionDays(): array
    {
        return [self::DAY_1, self::DAY_2, self::DAY_BOTH];
    }

    public static function currentDay(): string
    {
        if (! Schema::hasTable('festival_settings')) {
            return self::DAY_1;
        }

        return Cache::remember('festival:current_day', 60, function () {
            $value = static::query()->whereKey(self::KEY_CURRENT_DAY)->value('value');

            return in_array($value, self::allowedDays(), true) ? $value : self::DAY_1;
        });
    }

    public static function setCurrentDay(string $day): string
    {
        if (! in_array($day, self::allowedDays(), true)) {
            throw new \InvalidArgumentException('invalid festival day');
        }

        static::query()->updateOrCreate(
            ['key' => self::KEY_CURRENT_DAY],
            ['value' => $day],
        );

        Cache::forget('festival:current_day');
        self::forgetVisitorListCaches();

        return $day;
    }

    /** 来場者向け一覧キャッシュを消す（日替わり直後に古い一覧が出ないように） */
    public static function forgetVisitorListCaches(): void
    {
        foreach (self::allowedDays() as $day) {
            Cache::forget('api:v1:restaurants:index:'.$day);
            Cache::forget('api:v1:call-numbers:all:'.$day);
            Cache::forget('api:v1:monitor:call-numbers:'.$day);
        }
        Cache::forget('api:v1:restaurants:index');
        Cache::forget('api:v1:call-numbers:all');
        Cache::forget('api:v1:monitor:call-numbers');
    }

    public static function storeMatchesDay(?string $exhibitionDay, ?string $currentDay = null): bool
    {
        $day = $currentDay ?? self::currentDay();
        $exhibition = $exhibitionDay ?: self::DAY_BOTH;

        return $exhibition === self::DAY_BOTH || $exhibition === $day;
    }
}
