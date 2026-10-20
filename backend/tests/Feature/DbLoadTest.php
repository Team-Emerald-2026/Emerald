<?php

namespace Tests\Feature;

use App\Models\EventNotice;
use App\Support\DbSchema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DbLoadTest extends TestCase
{
    use RefreshDatabase;

    public function test_schema_checks_are_cached_until_flushed(): void
    {
        $this->assertTrue(DbSchema::hasColumn('stores', 'name'));

        DB::enableQueryLog();
        $this->assertTrue(DbSchema::hasColumn('stores', 'name'));
        $this->assertFalse(DbSchema::hasColumn('stores', 'no_such_column'));
        $this->assertTrue(DbSchema::hasTable('stores'));
        $this->assertCount(1, DB::getQueryLog());

        DB::flushQueryLog();
        DbSchema::hasTable('stores');
        $this->assertCount(0, DB::getQueryLog());

        DbSchema::flush();
        DbSchema::hasColumn('stores', 'name');
        $this->assertNotEmpty(DB::getQueryLog());
    }

    public function test_ticker_does_not_alter_table_on_every_request(): void
    {
        $this->getJson('/api/v1/ticker')->assertOk();

        DB::enableQueryLog();
        $this->getJson('/api/v1/ticker')->assertOk();

        $alters = array_filter(
            DB::getQueryLog(),
            fn (array $query) => str_contains(strtolower($query['query']), 'alter table'),
        );
        $this->assertSame([], array_values($alters));
    }

    public function test_events_cache_is_cleared_when_an_event_is_saved(): void
    {
        config(['cache.api_list_ttl' => 60]);

        $this->getJson('/api/v1/events')->assertOk()->assertJsonCount(0, 'data');

        $event = EventNotice::query()->create([
            'title' => '開会式',
            'body' => '体育館',
            'type' => 'event',
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHour(),
            'is_published' => true,
        ]);

        $this->getJson('/api/v1/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', '開会式');

        $event->delete();

        $this->getJson('/api/v1/events')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_map_is_served_from_cache_within_ttl(): void
    {
        config(['cache.api_list_ttl' => 60]);

        $first = $this->getJson('/api/v1/map/facilities')->assertOk()->json();

        DB::enableQueryLog();
        $second = $this->getJson('/api/v1/map/facilities')->assertOk()->json();

        $facilityQueries = array_filter(
            DB::getQueryLog(),
            fn (array $query) => str_contains($query['query'], 'map_facilities'),
        );
        $this->assertSame([], array_values($facilityQueries));
        $this->assertSame($first, $second);
    }
}
