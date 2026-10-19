<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ApiAccessLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminAccessLogTest extends TestCase
{
    use RefreshDatabase;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->directory = storage_path('framework/testing/access-logs-'.getmypid());
        if (! is_dir($this->directory)) {
            mkdir($this->directory, 0775, true);
        }

        config([
            'access.enabled' => true,
            'access.log_directory' => $this->directory,
            'access.slow_ms' => 1000,
        ]);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
        if (is_dir($this->directory)) {
            rmdir($this->directory);
        }

        parent::tearDown();
    }

    public function test_requests_are_appended_without_query_or_address(): void
    {
        $this->getJson('/api/v1/restaurants?day=day1')->assertOk();
        $this->getJson('/api/v1/call-numbers')->assertOk();
        $this->getJson('/api/v1/restaurants/store-404?poll=1')->assertNotFound();

        $date = now('Asia/Tokyo')->toDateString();
        $body = file_get_contents($this->directory.DIRECTORY_SEPARATOR.'access-'.$date.'.log');
        $this->assertIsString($body);
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00 GET \/api\/v1\/restaurants 200 \d+$/m',
            $body,
        );
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00 GET \/api\/v1\/call-numbers 200 \d+$/m',
            $body,
        );
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00 GET \/api\/v1\/restaurants\/store-404 404 \d+$/m',
            $body,
        );
        $this->assertStringNotContainsString('day=', $body);
        $this->assertStringNotContainsString('poll=', $body);
        $this->assertStringNotContainsString('Bearer', $body);
    }

    public function test_admin_can_read_summary_and_download_text(): void
    {
        // 実行日と同じ日付だと RecordApiAccess が追記して download 検証が壊れるので固定の過去日を使う
        $date = '2026-09-15';
        file_put_contents(
            $this->directory.DIRECTORY_SEPARATOR.'access-'.$date.'.log',
            implode("\n", [
                '2026-09-15T11:10:00+09:00 GET /api/v1/restaurants 200 20',
                '2026-09-15T12:05:00+09:00 GET /api/v1/monitor/call-numbers 200 30',
                '2026-09-15T12:06:00+09:00 GET /api/v1/monitor/call-numbers 200 40',
                '2026-09-15T12:40:00+09:00 POST /api/v1/booth/accounting/orders 201 80',
                '2026-09-15T13:15:00+09:00 GET /api/v1/restaurants 500 1500',
                'not a log line',
            ])."\n",
        );

        Sanctum::actingAs($this->createAdmin());

        $this->getJson('/api/v1/admin/access?date='.$date)
            ->assertOk()
            ->assertJsonPath('data.date', $date)
            ->assertJsonPath('data.total', 5)
            ->assertJsonPath('data.visitor', 2)
            ->assertJsonPath('data.poll', 2)
            ->assertJsonPath('data.store', 1)
            ->assertJsonPath('data.admin', 0)
            ->assertJsonPath('data.server_error', 1)
            ->assertJsonPath('data.slow', 1)
            ->assertJsonPath('data.peak.hour', '12')
            ->assertJsonPath('data.peak.count', 3)
            ->assertJsonPath('data.peak_slot.slot', '12:00')
            ->assertJsonPath('data.peak_slot.count', 2)
            ->assertJsonPath('data.slots.0.slot', '11:00')
            ->assertJsonPath('data.slots.0.total', 1)
            ->assertJsonPath('data.slots.1.slot', '11:30')
            ->assertJsonPath('data.slots.1.total', 0)
            ->assertJsonPath('data.slots.2.slot', '12:00')
            ->assertJsonPath('data.slots.2.total', 2)
            ->assertJsonPath('data.slots.2.slow', 0)
            ->assertJsonPath('data.slots.2.server_error', 0)
            ->assertJsonPath('data.slots.3.slot', '12:30')
            ->assertJsonPath('data.slots.3.total', 1)
            ->assertJsonPath('data.slots.4.slot', '13:00')
            ->assertJsonPath('data.slots.4.total', 1)
            ->assertJsonPath('data.slots.4.server_error', 1)
            ->assertJsonPath('data.slots.4.slow', 1);

        $response = $this->get('/api/v1/admin/access/log?date='.$date);
        $response->assertOk();
        $response->assertHeader('content-type', 'text/plain; charset=UTF-8');
        $this->assertStringContainsString('access-2026-09-15.txt', (string) $response->headers->get('content-disposition'));
        $this->assertStringContainsString('GET /api/v1/monitor/call-numbers 200 30', $response->streamedContent());
        $this->assertDoesNotMatchRegularExpression('/\b(visitor|poll|store|admin)\b/', $response->streamedContent());
    }

    public function test_access_log_requires_admin(): void
    {
        $this->getJson('/api/v1/admin/access')->assertUnauthorized();
        $this->getJson('/api/v1/admin/access/log')->assertUnauthorized();

        Sanctum::actingAs(User::query()->create([
            'login_id' => 'cafe_admin',
            'password' => Hash::make('password123'),
            'store_id' => null,
            'role' => 'store',
        ]));

        $this->getJson('/api/v1/admin/access')->assertForbidden();
        $this->getJson('/api/v1/admin/access/log')->assertForbidden();
    }

    public function test_invalid_date_is_rejected(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $this->getJson('/api/v1/admin/access?date=2026-13-40')->assertStatus(422);
        $this->getJson('/api/v1/admin/access?date=../.env')->assertStatus(422);
    }

    public function test_missing_log_returns_empty_summary_and_not_found_download(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $this->getJson('/api/v1/admin/access?date=2020-01-01')
            ->assertOk()
            ->assertJsonPath('data.total', 0)
            ->assertJsonPath('data.peak', null)
            ->assertJsonPath('data.peak_slot', null)
            ->assertJsonPath('data.slots', []);

        $this->getJson('/api/v1/admin/access/log?date=2020-01-01')->assertNotFound();
    }

    public function test_parser_ignores_broken_lines(): void
    {
        $log = new ApiAccessLog;

        $this->assertNull($log->parseLine('garbage'));
        $parsed = $log->parseLine('2026-10-19T12:01:02+09:00 GET /api/v1/ticker 200 15');
        $this->assertSame('12', $parsed['hour']);
        $this->assertSame('12:00', $parsed['slot']);
        $this->assertSame('poll', $parsed['category']);
        $this->assertSame('poll', $log->parseLine(
            '2026-10-19T12:01:02+09:00 GET /api/v1/restaurants 200 15 poll',
        )['category']);
        $this->assertSame('visitor', $log->parseLine(
            '2026-10-19T11:10:00+09:00 GET /api/v1/restaurants 200 20',
        )['category']);
        $this->assertSame('store', $log->parseLine(
            '2026-10-19T12:40:00+09:00 POST /api/v1/booth/accounting/orders 201 80',
        )['category']);
        $this->assertSame('admin', $log->parseLine(
            '2026-10-19T12:40:00+09:00 GET /api/v1/admin/access 200 10',
        )['category']);
        $this->assertSame('12:30', $log->parseLine(
            '2026-10-19T12:40:00+09:00 GET /api/v1/ticker 200 15',
        )['slot']);
    }

    private function createAdmin(): User
    {
        return User::query()->create([
            'login_id' => 'admin',
            'password' => Hash::make('password123'),
            'store_id' => null,
            'role' => 'admin',
        ]);
    }
}
