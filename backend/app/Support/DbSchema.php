<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * テーブル・列があるかの確認結果を覚えておく。
 * Schema::hasColumn / hasTable は PostgreSQL では毎回システムカタログを引くため重く、
 * よく呼ばれるAPIで使うと、アクセスが集中したときに DB の CPU を使い切る。
 * 結果はキャッシュに置き、マイグレーションのあと（MigrationsEnded）に捨てる。
 */
class DbSchema
{
    private const TTL_SECONDS = 600;

    private const VERSION_KEY = 'db-schema:version';

    /** @var array<string, mixed> 同じリクエスト内ではキャッシュも読まずに返す */
    private array $memo = [];

    public static function hasTable(string $table): bool
    {
        return (bool) self::remember('table:'.$table, fn () => Schema::hasTable($table));
    }

    public static function hasColumn(string $table, string $column): bool
    {
        $columns = self::remember(
            'columns:'.$table,
            fn () => array_map('strtolower', Schema::getColumnListing($table)),
        );

        return in_array(strtolower($column), $columns, true);
    }

    /**
     * 任意の確認（列があるか等）の結果を、上と同じ仕組みで覚えておく。
     */
    public static function remember(string $name, Closure $probe): mixed
    {
        $instance = app(self::class);
        $key = self::cacheKey($name);

        if (array_key_exists($key, $instance->memo)) {
            return $instance->memo[$key];
        }

        return $instance->memo[$key] = Cache::remember($key, self::TTL_SECONDS, $probe);
    }

    /** 列を足したあとなど、覚えている結果をすべて捨てる */
    public static function flush(): void
    {
        Cache::forever(self::VERSION_KEY, (string) Str::uuid());
        app(self::class)->memo = [];
    }

    private static function cacheKey(string $name): string
    {
        $version = app(self::class)->memo[self::VERSION_KEY]
            ??= (string) Cache::rememberForever(self::VERSION_KEY, fn () => (string) Str::uuid());

        return 'db-schema:'.$version.':'.$name;
    }
}
