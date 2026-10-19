<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Http\Request;

class ApiAccessLog
{
    public const CATEGORIES = ['visitor', 'poll', 'store', 'admin'];

    private const POLL_PATHS = [
        'api/v1/call-numbers',
        'api/v1/monitor/call-numbers',
        'api/v1/ticker',
        'api/v1/booth/dashboard',
        'api/v1/booth/accounting/orders',
    ];

    public function write(Request $request, int $status, int $milliseconds): void
    {
        if (! config('access.enabled')) {
            return;
        }

        try {
            $now = Carbon::now('Asia/Tokyo');
            $directory = $this->directory();
            if (! is_dir($directory) && ! mkdir($directory, 0775, true) && ! is_dir($directory)) {
                return;
            }

            $line = sprintf(
                "%s %s %s %d %d\n",
                $now->format('Y-m-d\TH:i:sP'),
                $this->method($request),
                $this->safePath($request),
                $this->status($status),
                max(0, $milliseconds),
            );

            file_put_contents(
                $this->pathFor($now->toDateString()),
                $line,
                FILE_APPEND | LOCK_EX,
            );
        } catch (\Throwable) {
            // ログの失敗で API 自体を落とさない
        }
    }

    /**
     * @return array{
     *     date: string,
     *     total: int,
     *     visitor: int,
     *     poll: int,
     *     store: int,
     *     admin: int,
     *     server_error: int,
     *     slow: int,
     *     slow_ms: int,
     *     peak: array{hour: string, count: int}|null,
     *     hours: list<array{
     *         hour: string,
     *         total: int,
     *         visitor: int,
     *         poll: int,
     *         store: int,
     *         admin: int,
     *         server_error: int,
     *         slow: int
     *     }>,
     *     peak_slot: array{slot: string, count: int}|null,
     *     slots: list<array{
     *         slot: string,
     *         total: int,
     *         visitor: int,
     *         poll: int,
     *         store: int,
     *         admin: int,
     *         server_error: int,
     *         slow: int
     *     }>
     * }
     */
    public function summarize(string $date): array
    {
        $slowMs = max(1, (int) config('access.slow_ms', 1000));
        $hours = [];
        $slots = [];

        $path = $this->pathFor($date);
        if (is_file($path)) {
            $handle = fopen($path, 'rb');
            if ($handle !== false) {
                try {
                    while (($line = fgets($handle)) !== false) {
                        $parsed = $this->parseLine($line);
                        if ($parsed === null || $parsed['date'] !== $date) {
                            continue;
                        }

                        $this->record($hours, $parsed['hour'], $parsed, $slowMs);
                        $this->record($slots, $parsed['slot'], $parsed, $slowMs);
                    }
                } finally {
                    fclose($handle);
                }
            }
        }

        [$hourRows, $peak, $totals] = $this->collapse($hours, 'hour');
        [$slotRows, $peakSlot] = $this->collapse($slots, 'slot');
        $slotRows = $this->fillHalfHours($slotRows);

        return [
            'date' => $date,
            'total' => $totals['total'],
            'visitor' => $totals['visitor'],
            'poll' => $totals['poll'],
            'store' => $totals['store'],
            'admin' => $totals['admin'],
            'server_error' => $totals['server_error'],
            'slow' => $totals['slow'],
            'slow_ms' => $slowMs,
            'peak' => $peak,
            'hours' => $hourRows,
            'peak_slot' => $peakSlot,
            'slots' => $slotRows,
        ];
    }

    public function pathFor(string $date): string
    {
        return $this->directory().DIRECTORY_SEPARATOR.'access-'.$date.'.log';
    }

    public function readablePath(string $date): ?string
    {
        $path = $this->pathFor($date);
        if (! is_file($path)) {
            return null;
        }

        $realFile = realpath($path);
        $realDirectory = realpath($this->directory());
        if ($realFile === false || $realDirectory === false) {
            return null;
        }

        $prefix = rtrim($realDirectory, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR;
        if (! str_starts_with($realFile, $prefix)) {
            return null;
        }

        return $realFile;
    }

    public function category(Request $request): string
    {
        $path = trim($request->path(), '/');

        if ($request->query('poll') === '1') {
            return 'poll';
        }

        return $this->categoryFor($request->getMethod(), '/'.$path);
    }

    private function categoryFor(string $method, string $path): string
    {
        $path = trim($path, '/');
        $method = strtoupper($method);

        if (str_starts_with($path, 'api/v1/admin')) {
            return 'admin';
        }

        if (in_array($method, ['GET', 'HEAD'], true) && in_array($path, self::POLL_PATHS, true)) {
            return 'poll';
        }

        if (str_starts_with($path, 'api/v1/booth')) {
            return 'store';
        }

        return 'visitor';
    }

    /**
     * @return array{date: string, hour: string, slot: string, status: int, milliseconds: int, category: string}|null
     */
    public function parseLine(string $line): ?array
    {
        $line = rtrim($line, "\r\n");
        if (! preg_match(
            '/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}\+09:00 ([A-Z]+) (\S+) (\d{3}) (\d+)(?: (visitor|poll|store|admin))?$/',
            $line,
            $matches,
        )) {
            return null;
        }

        $minute = (int) $matches[3];
        $category = $matches[8] ?? '';
        if (! in_array($category, self::CATEGORIES, true)) {
            $category = $this->categoryFor($matches[4], $matches[5]);
        }

        return [
            'date' => $matches[1],
            'hour' => $matches[2],
            'slot' => $matches[2].':'.($minute < 30 ? '00' : '30'),
            'status' => (int) $matches[6],
            'milliseconds' => (int) $matches[7],
            'category' => $category,
        ];
    }

    private function method(Request $request): string
    {
        $method = strtoupper($request->getMethod());

        return preg_match('/^[A-Z]+$/', $method) === 1 ? $method : 'GET';
    }

    private function safePath(Request $request): string
    {
        $path = str_replace(["\t", "\r", "\n", ' '], '', $request->getPathInfo());

        return $path !== '' ? $path : '/';
    }

    private function status(int $status): int
    {
        return ($status >= 100 && $status <= 599) ? $status : 0;
    }

    private function directory(): string
    {
        $configured = config('access.log_directory');

        return is_string($configured) && $configured !== ''
            ? $configured
            : storage_path('logs/access');
    }

    /**
     * @param  array{date: string, hour: string, slot: string, status: int, milliseconds: int, category: string}  $parsed
     * @param  array<string, array{total: int, visitor: int, poll: int, store: int, admin: int, server_error: int, slow: int}>  $buckets
     */
    private function record(array &$buckets, string $key, array $parsed, int $slowMs): void
    {
        if (! isset($buckets[$key])) {
            $buckets[$key] = $this->emptyBucket();
        }

        $buckets[$key][$parsed['category']]++;
        $buckets[$key]['total']++;
        if ($parsed['status'] >= 500) {
            $buckets[$key]['server_error']++;
        }
        if ($parsed['milliseconds'] >= $slowMs) {
            $buckets[$key]['slow']++;
        }
    }

    /**
     * @param  array<string, array{total: int, visitor: int, poll: int, store: int, admin: int, server_error: int, slow: int}>  $buckets
     * @return array{0: list<array<string, int|string>>, 1: array{count: int, hour?: string, slot?: string}|null, 2: array{total: int, visitor: int, poll: int, store: int, admin: int, server_error: int, slow: int}}
     */
    private function collapse(array $buckets, string $label): array
    {
        ksort($buckets);

        $totals = $this->emptyBucket();
        $rows = [];
        $peak = null;

        foreach ($buckets as $key => $bucket) {
            if ($bucket['total'] === 0) {
                continue;
            }

            foreach (['total', 'visitor', 'poll', 'store', 'admin', 'server_error', 'slow'] as $field) {
                $totals[$field] += $bucket[$field];
            }

            // PHP は数字だけの配列キーを int にするので、API では文字列に揃える
            $labelValue = (string) $key;
            $rows[] = [$label => $labelValue] + $bucket;

            if ($peak === null || $bucket['total'] > $peak['count']) {
                $peak = [$label => $labelValue, 'count' => $bucket['total']];
            }
        }

        return [$rows, $peak, $totals];
    }

    /**
     * 最初の記録から最後の記録まで、30分刻みを欠かさず並べる。
     *
     * @param  list<array<string, int|string>>  $rows
     * @return list<array<string, int|string>>
     */
    private function fillHalfHours(array $rows): array
    {
        if (count($rows) < 2) {
            return $rows;
        }

        $bySlot = [];
        foreach ($rows as $row) {
            $bySlot[$row['slot']] = $row;
        }

        $start = $this->slotIndex((string) $rows[0]['slot']);
        $end = $this->slotIndex((string) $rows[array_key_last($rows)]['slot']);
        $filled = [];

        for ($index = $start; $index <= $end; $index++) {
            $slot = sprintf('%02d:%s', intdiv($index, 2), ($index % 2) === 0 ? '00' : '30');
            $filled[] = $bySlot[$slot] ?? ['slot' => $slot] + $this->emptyBucket();
        }

        return $filled;
    }

    private function slotIndex(string $slot): int
    {
        [$hour, $minute] = array_map('intval', explode(':', $slot, 2));

        return $hour * 2 + ($minute >= 30 ? 1 : 0);
    }

    /**
     * @return array{total: int, visitor: int, poll: int, store: int, admin: int, server_error: int, slow: int}
     */
    private function emptyBucket(): array
    {
        return [
            'total' => 0,
            'visitor' => 0,
            'poll' => 0,
            'store' => 0,
            'admin' => 0,
            'server_error' => 0,
            'slow' => 0,
        ];
    }
}
