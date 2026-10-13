<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

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
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_published' => 'boolean',
        'ticker_lead_minutes' => 'integer',
        'ticker_after_minutes' => 'integer',
    ];

    /** 開始から何分後まで電光掲示板に流すか（未指定のときの既定値） */
    public const TICKER_DEFAULT_AFTER_MINUTES = 20;

    /**
     * いま電光掲示板に流す時間帯かどうか。
     * 「開始の ticker_lead_minutes 分前」から「開始の ticker_after_minutes 分後」まで。
     */
    public function isTickerActiveAt($at = null): bool
    {
        if ($this->ticker_lead_minutes === null || $this->starts_at === null) {
            return false;
        }

        $at = $at ?? now();
        $from = $this->starts_at->copy()->subMinutes($this->ticker_lead_minutes);
        $until = $this->starts_at->copy()->addMinutes(
            $this->ticker_after_minutes ?? self::TICKER_DEFAULT_AFTER_MINUTES,
        );

        return $at->gte($from) && $at->lte($until);
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
