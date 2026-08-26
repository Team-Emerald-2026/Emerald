<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BoothDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_user_can_fetch_dashboard(): void
    {
        $store = Store::query()->create([
            'id' => 'store-profile',
            'name' => 'プロフィール店舗',
            'description' => '店舗情報の確認用',
            'is_open' => true,
            'current_wait_min' => 7,
            'current_queue_count' => 3,
        ]);

        $user = User::query()->create([
            'login_id' => 'profile-user',
            'password' => Hash::make('password'),
            'store_id' => $store->id,
            'role' => 'store',
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/booth/dashboard')
            ->assertOk()
            ->assertJsonPath('data.id', 'store-profile')
            ->assertJsonPath('data.name', 'プロフィール店舗')
            ->assertJsonPath('data.description', '店舗情報の確認用')
            ->assertJsonPath('data.is_open', true)
            ->assertJsonPath('data.current_wait_min', 7)
            ->assertJsonPath('data.current_queue_count', 3);
    }

    public function test_store_user_can_update_dashboard_profile(): void
    {
        $store = Store::query()->create([
            'id' => 'store-profile-edit',
            'name' => '旧店舗名',
            'description' => '旧説明',
            'is_open' => false,
            'current_wait_min' => 0,
            'current_queue_count' => 0,
        ]);

        $user = User::query()->create([
            'login_id' => 'profile-editor',
            'password' => Hash::make('password'),
            'store_id' => $store->id,
            'role' => 'store',
        ]);

        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/booth/dashboard/store-profile-edit', [
            'name' => '新店舗名',
            'description' => '新説明',
            'current_wait_min' => 5,
            'is_open' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.id', 'store-profile-edit')
            ->assertJsonPath('data.name', '新店舗名')
            ->assertJsonPath('data.description', '新説明')
            ->assertJsonPath('data.current_wait_min', 5)
            ->assertJsonPath('data.is_open', true);
    }
}
