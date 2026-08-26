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
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_published' => 'boolean',
    ];

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
