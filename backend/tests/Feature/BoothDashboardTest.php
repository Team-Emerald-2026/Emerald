<?php

namespace Tests\Feature;

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\SalesEntry;
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
            ->assertJsonPath('data.current_queue_count', 3)
            ->assertJsonPath('data.crowd_level', null);
    }

    public function test_dashboard_includes_sales_breakdown(): void
    {
        $store = Store::query()->create([
            'id' => 'store-sales',
            'name' => '売上確認店舗',
            'description' => '売上内訳の確認用',
            'is_open' => true,
            'current_wait_min' => 0,
            'current_queue_count' => 0,
        ]);

        $user = User::query()->create([
            'login_id' => 'sales-user',
            'password' => Hash::make('password'),
            'store_id' => $store->id,
            'role' => 'store',
        ]);

        $yakisoba = MenuItem::query()->create([
            'store_id' => $store->id,
            'name' => '焼きそば',
            'description' => null,
            'price' => 500,
            'is_available' => true,
        ]);
        $juice = MenuItem::query()->create([
            'store_id' => $store->id,
            'name' => 'ジュース',
            'description' => null,
            'price' => 200,
            'is_available' => true,
        ]);

        // 清算済みの会計（売上に入る）
        $settled = Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => '1',
            'total_price' => 1200,
            'status' => 'settled',
            'ordered_at' => now(),
            'settled_at' => now(),
        ]);
        $settled->items()->create([
            'menu_item_id' => $yakisoba->id,
            'quantity' => 2,
            'unit_price' => 500,
            'subtotal' => 1000,
        ]);
        $settled->items()->create([
            'menu_item_id' => $juice->id,
            'quantity' => 1,
            'unit_price' => 200,
            'subtotal' => 200,
        ]);

        // 未清算の会計（売上に入らない）
        $issued = Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => '2',
            'total_price' => 500,
            'status' => 'issued',
            'ordered_at' => now(),
        ]);
        $issued->items()->create([
            'menu_item_id' => $yakisoba->id,
            'quantity' => 1,
            'unit_price' => 500,
            'subtotal' => 500,
        ]);

        // 手入力の売上
        SalesEntry::query()->create([
            'store_id' => $store->id,
            'amount' => 300,
            'memo' => 'テスト',
            'recorded_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/booth/dashboard')
            ->assertOk()
            ->assertJsonPath('data.revenue', 1500)
            ->assertJsonPath('data.order_revenue', 1200)
            ->assertJsonPath('data.sales_entry_revenue', 300)
            ->assertJsonPath('data.settled_order_count', 1)
            ->assertJsonCount(2, 'data.item_sales')
            ->assertJsonPath('data.item_sales.0.name', '焼きそば')
            ->assertJsonPath('data.item_sales.0.quantity', 2)
            ->assertJsonPath('data.item_sales.0.subtotal', 1000)
            ->assertJsonPath('data.item_sales.1.name', 'ジュース')
            ->assertJsonPath('data.item_sales.1.quantity', 1)
            ->assertJsonPath('data.item_sales.1.subtotal', 200);
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
