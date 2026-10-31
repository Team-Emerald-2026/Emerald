<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    private function createAdmin(): User
    {
        return User::query()->create([
            'login_id' => 'admin',
            'password' => Hash::make('password123'),
            'store_id' => null,
            'role' => 'admin',
        ]);
    }

    private function storePayload(array $overrides = []): array
    {
        return array_merge([
            'id' => 'store-audit',
            'name' => '監査テスト店',
            'description' => '',
            'type' => 'booth',
            'floor' => 3,
            'map_x' => 10,
            'map_y' => 20,
            'login_id' => 'audit01',
            'password' => 'Secret1234',
            'exhibition_day' => 'both',
            'is_open' => true,
            'is_visible' => true,
            'show_on_monitor' => false,
            'current_wait_min' => 0,
            'current_queue_count' => 0,
        ], $overrides);
    }

    public function test_store_logins_are_recorded_without_passwords(): void
    {
        Sanctum::actingAs($this->createAdmin());
        $this->postJson('/api/v1/admin/stores', $this->storePayload())->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/v1/booth/auth/login', ['login_id' => 'nobody', 'password' => 'Secret1234'])
            ->assertUnauthorized();
        $this->postJson('/api/v1/booth/auth/login', ['login_id' => 'audit01', 'password' => 'Wrong1234'])
            ->assertUnauthorized();
        $this->postJson('/api/v1/booth/auth/login', ['login_id' => 'audit01', 'password' => 'Secret1234'])
            ->assertOk();

        $failed = AuditLog::query()->where('action', 'store.login_failed')->orderBy('id')->get();
        $this->assertSame(['nobody', 'audit01'], $failed->pluck('target_id')->all());
        $this->assertSame(['unknown_login_id', 'wrong_password'], $failed->pluck('details.reason')->all());

        $success = AuditLog::query()->where('action', 'store.login')->sole();
        $this->assertSame('audit01', $success->target_id);
        $this->assertSame('store-audit', $success->details['store_id']);

        $this->assertNoPasswordsStored();
    }

    public function test_admin_store_operations_are_recorded(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $this->postJson('/api/v1/admin/stores', $this->storePayload())->assertCreated();
        $this->patchJson('/api/v1/admin/stores/store-audit', $this->storePayload([
            'name' => '名前を変えた',
            'floor' => 5,
            'password' => 'Changed5678',
        ]))->assertOk();
        $this->patchJson('/api/v1/admin/stores/store-audit', $this->storePayload([
            'name' => '名前を変えた',
            'floor' => 5,
            'password' => '',
        ]))->assertOk();
        $this->deleteJson('/api/v1/admin/stores/store-audit')->assertOk();
        $this->deleteJson('/api/v1/admin/stores/store-audit/permanent')->assertNoContent();

        $logs = AuditLog::query()->where('target_id', 'store-audit')->orderBy('id')->get();
        $this->assertSame(
            ['store.create', 'store.update', 'store.update', 'store.hide', 'store.force_delete'],
            $logs->pluck('action')->all(),
        );
        $this->assertTrue($logs->every(fn (AuditLog $log) => $log->actor_login_id === 'admin'));

        [$create, $changed, $unchanged, , $deleted] = $logs->all();
        $this->assertSame('audit01', $create->details['login_id']);
        $this->assertSame(['from' => '監査テスト店', 'to' => '名前を変えた'], $changed->details['changes']['name']);
        $this->assertSame(['from' => 3, 'to' => 5], $changed->details['changes']['floor']);
        $this->assertTrue($changed->details['password_changed']);
        $this->assertSame([], $unchanged->details['changes']);
        $this->assertFalse($unchanged->details['password_changed']);
        $this->assertSame(['audit01'], $deleted->details['login_ids']);

        $this->assertNoPasswordsStored();
    }

    public function test_audit_recent_command_lists_logs(): void
    {
        AuditLog::query()->create([
            'action' => 'store.login_failed',
            'target_id' => 'store303-1',
            'details' => ['reason' => 'wrong_password'],
        ]);

        $this->artisan('audit:recent', ['--target' => 'store303-1'])
            ->expectsOutputToContain('store.login_failed')
            ->assertSuccessful();
        $this->artisan('audit:recent', ['--target' => 'nothing'])
            ->expectsOutput('記録はありません。')
            ->assertSuccessful();
    }

    private function assertNoPasswordsStored(): void
    {
        $dump = json_encode(DB::table('audit_logs')->get());
        foreach (['Secret1234', 'Wrong1234', 'Changed5678'] as $password) {
            $this->assertStringNotContainsString($password, $dump);
        }
    }
}
