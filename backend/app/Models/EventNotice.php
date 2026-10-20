<?php

namespace App\Models;

use App\Support\DbSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class EventNotice extends Model
{
    protected $fillable = [
        'title',
        'body',
        'type',
        'starts_at',
        'ends_at',
        'is_published',
        'ticker_lead_minutes',
        'ticker_after_minutes',
        'ticker_started_at',
        'map_facility_id',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_published' => 'boolean',
        'ticker_lead_minutes' => 'integer',
        'ticker_after_minutes' => 'integer',
        'ticker_started_at' => 'datetime',
    ];

    /** 開始から何分後まで電光掲示板に流すか（未指定のときの既定値） */
    public const TICKER_DEFAULT_AFTER_MINUTES = 20;

    public const EVENTS_CACHE_KEY = 'api:v1:events:index';

    public const TICKER_CACHE_KEY = 'api:v1:ticker';

    protected static function booted(): void
    {
        // 管理画面で変えた内容が、来場者側にすぐ出るようにする
        static::saved(fn () => self::forgetVisitorCaches());
        static::deleted(fn () => self::forgetVisitorCaches());
    }

    public static function forgetVisitorCaches(): void
    {
        Cache::forget(self::EVENTS_CACHE_KEY);
        Cache::forget(self::TICKER_CACHE_KEY);
    }

    /**
     * 本番で ticker_started_at が無いと掲示板の保存・取得が 500 になる。
     * Schema::hasColumn が誤って true を返すケースがあったので、
     * 追加を試みて「既にある」エラーだけ無視する。
     * 失敗する ALTER TABLE でもテーブルをロックするので、毎回は試さない。
     */
    public static function ensureTickerStartedAtColumn(): void
    {
        DbSchema::remember('event_notices:ticker_started_at:ensured', function (): bool {
            try {
                Schema::table('event_notices', function (Blueprint $table) {
                    $table->timestamp('ticker_started_at')->nullable();
                });
                DbSchema::flush();
            } catch (\Throwable) {
                // 既にある（またはマイグレーション済み）なら何もしない
            }

            return true;
        });
    }

    /**
     * いま電光掲示板に流す時間帯かどうか。
     * - イベント: 「開始の ticker_lead_minutes 分前」から「開始の ticker_after_minutes 分後」まで
     * - お知らせ: 「流し始めた時刻（ticker_started_at）」から ticker_after_minutes 分間。null なら止めるまで
     */
    public function isTickerActiveAt($at = null): bool
    {
        $at = $at ?? now();

        if ($this->type === 'notice') {
            if ($this->ticker_started_at === null || $at->lt($this->ticker_started_at)) {
                return false;
            }

            return $this->ticker_after_minutes === null
                || $at->lte($this->ticker_started_at->copy()->addMinutes($this->ticker_after_minutes));
        }

        if ($this->ticker_lead_minutes === null || $this->starts_at === null) {
            return false;
        }

        $from = $this->starts_at->copy()->subMinutes($this->ticker_lead_minutes);
        $until = $this->starts_at->copy()->addMinutes(
            $this->ticker_after_minutes ?? self::TICKER_DEFAULT_AFTER_MINUTES,
        );

        return $at->gte($from) && $at->lte($until);
    }

    /** 開催場所（校内マップの部屋） */
    public function mapFacility(): BelongsTo
    {
        return $this->belongsTo(MapFacilities::class, 'map_facility_id');
    }

    /** 表示用の場所（例: 8F・801）。場所がなければ null */
    public function locationLabel(): ?string
    {
        $facility = $this->mapFacility;

        return $facility ? "{$facility->floor}F・{$facility->name}" : null;
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('is_published', true);
    }

    public function scopeVisibleAt(Builder $query, $at = null): Builder
    {
        $at = $at ?? now();

        return $query
            ->where(function (Builder $inner) use ($at) {
                $inner->whereNull('starts_at')->orWhere('starts_at', '<=', $at);
            })
            ->where(function (Builder $inner) use ($at) {
                $inner->whereNull('ends_at')->orWhere('ends_at', '>=', $at);
            });
    }
}
