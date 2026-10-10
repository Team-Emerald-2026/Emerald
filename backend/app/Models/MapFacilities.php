<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MapFacilities extends Model
{
    protected $table = 'map_facilities';

    protected $fillable = [
        'store_id',
        'name',
        'type',
        'floor',
        'x',
        'y',
    ];

    protected $casts = [
        'store_id' => 'string',
        'floor' => 'integer',
        'x' => 'integer',
        'y' => 'integer',
    ];

    /** 同じ階・同じ位置かを比べるためのキー */
    public static function positionKey(int|string $floor, int|string $x, int|string $y): string
    {
        return (int) $floor.':'.(int) $x.':'.(int) $y;
    }

    /**
     * 店舗が入っていない場所（空き枠）の名前を、位置をキーにして返す。
     * 店舗が入った枠は、この名前（部屋番号など）を「場所の名前」として表示する。
     *
     * @return array<string, string>
     */
    public static function slotLabels(): array
    {
        $labels = [];

        static::query()
            ->whereNull('store_id')
            ->orderBy('id')
            ->get(['floor', 'x', 'y', 'name'])
            ->each(function (self $slot) use (&$labels) {
                // 同じ位置に複数ある場合は、先に作られたものを使う
                $labels[self::positionKey($slot->floor, $slot->x, $slot->y)] ??= $slot->name;
            });

        return $labels;
    }
}
