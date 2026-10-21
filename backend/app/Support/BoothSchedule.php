<?php

namespace App\Support;

/**
 * 同じ教室を時間で入れ替えるブースの出展時間。
 * 時刻は日本時間の "HH:MM"。出展時間が無いブースは一日中出展している扱い。
 */
class BoothSchedule
{
    public const TIMEZONE = 'Asia/Tokyo';

    /**
     * 入力された時間帯を、日→開始時刻の順に並べて保存用の形にそろえる。
     *
     * @param  array<int, array{day?: string|null, start: string, end: string}>|null  $slots
     * @return list<array{day: string|null, start: string, end: string}>|null
     */
    public static function normalize(?array $slots): ?array
    {
        if ($slots === null || $slots === []) {
            return null;
        }

        $normalized = array_map(fn (array $slot) => [
            'day' => $slot['day'] ?? null,
            'start' => $slot['start'],
            'end' => $slot['end'],
        ], array_values($slots));

        usort($normalized, fn (array $a, array $b) => [$a['day'] ?? '', $a['start']] <=> [$b['day'] ?? '', $b['start']]);

        return $normalized;
    }

    /** DB の JSON 文字列 / 配列 / null を配列にそろえる。 */
    public static function decode(mixed $slots): array
    {
        if (is_string($slots)) {
            $slots = json_decode($slots, true);
        }

        return is_array($slots) ? $slots : [];
    }

    /**
     * その日の時間帯だけを開始時刻の順で返す。day が null の時間帯は両日に当てはまる。
     *
     * @return list<array{day: string|null, start: string, end: string}>
     */
    public static function slotsForDay(mixed $slots, string $day): array
    {
        $forDay = array_values(array_filter(
            self::decode($slots),
            fn ($slot) => is_array($slot)
                && isset($slot['start'], $slot['end'])
                && (($slot['day'] ?? null) === null || $slot['day'] === $day),
        ));
        usort($forDay, fn (array $a, array $b) => strcmp($a['start'], $b['start']));

        return $forDay;
    }

    /**
     * 同じ教室に複数のブースがあるとき、地図のピンに出す順番。小さいほど優先。
     * 本日なら「今出展中 → 一日中 → これから（早い順）→ 終了」。別の日なら開始が早い順。
     *
     * @param  list<array{start: string, end: string}>  $slotsForDay
     * @return array{0: int, 1: string}
     */
    public static function pinPriority(array $slotsForDay, bool $isToday, string $nowHm): array
    {
        if ($slotsForDay === []) {
            return [1, ''];
        }
        if (! $isToday) {
            return [2, $slotsForDay[0]['start']];
        }

        foreach ($slotsForDay as $slot) {
            if ($slot['start'] <= $nowHm && $nowHm < $slot['end']) {
                return [0, $slot['start']];
            }
        }
        foreach ($slotsForDay as $slot) {
            if ($nowHm < $slot['start']) {
                return [2, $slot['start']];
            }
        }

        // 全部終わったら、最後に終わったブースを優先（終了時刻の降順）
        [$hour, $minute] = array_map('intval', explode(':', $slotsForDay[array_key_last($slotsForDay)]['end']));

        return [3, str_pad((string) (1440 - ($hour * 60 + $minute)), 4, '0', STR_PAD_LEFT)];
    }
}
