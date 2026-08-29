<?php

namespace Tests\Feature;

use App\Models\EventNotice;
use App\Models\MapFacilities;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\SalesEntry;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MissingApisTest extends TestCase
{
    use RefreshDatabase;

    private function createStore(string $id = 'store-101', array $overrides = []): Store
    {
        return Store::query()->create(array_merge([
            'id' => $id,
            'name' => 'KTCカフェ',
            'description' => '学園祭限定メニュー',
            'ticket_prefix' => 'C',
            'is_open' => true,
            'is_visible' => true,
            'current_wait_min' => 10,
            'current_queue_count' => 5,
            'wait_display_mode' => 'minutes',
            'wait_display_text' => null,
        ], $overrides));
    }

    private function createStoreUser(Store $store, string $loginId = 'cafe_admin'): User
    {
        return User::query()->create([
            'login_id' => $loginId,
            'password' => Hash::make('password123'),
            'store_id' => $store->id,
            'role' => 'store',
        ]);
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

    public function test_store_user_can_update_wait_time(): void
    {
        $store = $this->createStore();
        Sanctum::actingAs($this->createStoreUser($store));

        $this->patchJson("/api/v1/store/{$store->id}/wait-time", [
            'current_wait_min' => 20,
            'current_queue_count' => 10,
            'wait_display_mode' => 'text',
            'wait_display_text' => '13時開始',
        ])
            ->assertOk()
            ->assertJsonPath('id', $store->id)
            ->assertJsonPath('current_wait_min', 20)
            ->assertJsonPath('current_queue_count', 10)
            ->assertJsonPath('wait_display_mode', 'text')
            ->assertJsonPath('wait_display_text', '13時開始');
    }

    public function test_store_user_cannot_update_other_store_wait_time(): void
    {
        $own = $this->createStore('store-101');
        $other = $this->createStore('store-102', ['ticket_prefix' => 'Y', 'name' => 'やきそば']);
        Sanctum::actingAs($this->createStoreUser($own));

        $this->patchJson("/api/v1/store/{$other->id}/wait-time", [
            'current_wait_min' => 1,
            'current_queue_count' => 1,
        ])->assertForbidden();
    }

    public function test_restaurant_detail_includes_menu_and_ticket_numbers(): void
    {
        $store = $this->createStore();
        MenuItem::query()->create([
            'store_id' => $store->id,
            'name' => 'ブレンドコーヒー',
            'description' => 'ホット',
            'price' => 350,
            'is_available' => true,
        ]);
        Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-120',
            'total_price' => 350,
            'status' => 'issued',
            'ordered_at' => now(),
            'called_at' => now(),
        ]);

        $this->getJson("/api/v1/restaurants/{$store->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'KTCカフェ')
            ->assertJsonPath('data.menu_items.0.name', 'ブレンドコーヒー')
            ->assertJsonPath('data.ticket_numbers.0', 'C-120');
    }

    public function test_public_call_numbers_returns_currently_called_tickets(): void
    {
        $store = $this->createStore();
        Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-120',
            'total_price' => 350,
            'status' => 'issued',
            'ordered_at' => now(),
            'called_at' => now(),
        ]);
        Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-121',
            'total_price' => 350,
            'status' => 'issued',
            'ordered_at' => now(),
            'served_at' => now(),
        ]);

        $this->getJson('/api/v1/call-numbers')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.ticket_number', 'C-120')
            ->assertJsonPath('data.0.store_id', 'store-101');
    }

    public function test_monitor_call_numbers_groups_by_store(): void
    {
        $store = $this->createStore();
        Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-120',
            'total_price' => 350,
            'status' => 'issued',
            'ordered_at' => now()->subMinutes(5),
            'called_at' => now(),
        ]);
        Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-121',
            'total_price' => 350,
            'status' => 'issued',
            'ordered_at' => now(),
        ]);

        $this->getJson('/api/v1/monitor/call-numbers')
            ->assertOk()
            ->assertJsonPath('data.0.store_id', 'store-101')
            ->assertJsonPath('data.0.current_call_number', 'C-120')
            ->assertJsonPath('data.0.waiting_numbers.0', 'C-121');
    }

    public function test_published_events_are_listed_and_unpublished_are_hidden(): void
    {
        $published = EventNotice::query()->create([
            'title' => '開会式',
            'body' => '体育館で開催します',
            'type' => 'event',
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHour(),
            'is_published' => true,
        ]);
        EventNotice::query()->create([
            'title' => '下書き',
            'body' => '非公開',
            'type' => 'notice',
            'is_published' => false,
        ]);

        $this->getJson('/api/v1/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', '開会式');

        $this->getJson("/api/v1/events/{$published->id}")
            ->assertOk()
            ->assertJsonPath('data.title', '開会式');
    }

    public function test_store_user_can_create_and_list_sales_entries(): void
    {
        $store = $this->createStore();
        Sanctum::actingAs($this->createStoreUser($store));

        $this->postJson('/api/v1/booth/sales', [
            'amount' => 15000,
            'memo' => '午前レジ締め',
        ])
            ->assertCreated()
            ->assertJsonPath('data.amount', 15000);

        $this->getJson('/api/v1/booth/sales')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.memo', '午前レジ締め');
    }

    public function test_store_user_can_call_and_serve_order(): void
    {
        $store = $this->createStore();
        Sanctum::actingAs($this->createStoreUser($store));
        $order = Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-130',
            'total_price' => 500,
            'status' => 'issued',
            'ordered_at' => now(),
        ]);

        $this->patchJson("/api/v1/booth/accounting/orders/{$order->id}/call")
            ->assertOk()
            ->assertJsonPath('data.ticket_number', 'C-130');

        $this->assertNotNull($order->refresh()->called_at);

        $this->patchJson("/api/v1/booth/accounting/orders/{$order->id}/serve")
            ->assertOk();

        $this->assertNotNull($order->refresh()->served_at);
        $this->assertSame(4, $store->refresh()->current_queue_count);
    }

    public function test_admin_can_fetch_store_detail_and_revenue(): void
    {
        $store = $this->createStore();
        SalesEntry::query()->create([
            'store_id' => $store->id,
            'amount' => 2000,
            'recorded_at' => now(),
        ]);
        Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-140',
            'total_price' => 800,
            'status' => 'settled',
            'ordered_at' => now(),
            'settled_at' => now(),
        ]);
        Sanctum::actingAs($this->createAdmin());

        $this->getJson("/api/v1/admin/stores/{$store->id}")
            ->assertOk()
            ->assertJsonPath('data.id', 'store-101')
            ->assertJsonPath('data.name', 'KTCカフェ');

        $this->getJson('/api/v1/admin/revenue')
            ->assertOk()
            ->assertJsonPath('data.order_revenue', 800)
            ->assertJsonPath('data.sales_entry_revenue', 2000)
            ->assertJsonPath('data.total_revenue', 2800);
    }

    public function test_admin_can_manage_events(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $created = $this->postJson('/api/v1/admin/events', [
            'title' => 'ステージ企画',
            'body' => '3階ホール',
            'type' => 'event',
            'is_published' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'ステージ企画');

        $id = $created->json('data.id');

        $this->patchJson("/api/v1/admin/events/{$id}", [
            'title' => 'ステージ企画（変更）',
            'body' => '3階ホール',
            'type' => 'event',
        ])
            ->assertOk()
            ->assertJsonPath('data.title', 'ステージ企画（変更）');

        $this->deleteJson("/api/v1/admin/events/{$id}")
            ->assertNoContent();
    }

    public function test_dashboard_includes_revenue(): void
    {
        $store = $this->createStore();
        Sanctum::actingAs($this->createStoreUser($store));
        Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-150',
            'total_price' => 1200,
            'status' => 'settled',
            'ordered_at' => now(),
            'settled_at' => now(),
        ]);

        $this->getJson('/api/v1/booth/dashboard')
            ->assertOk()
            ->assertJsonPath('data.revenue', 1200);
    }

    public function test_dashboard_succeeds_without_sales_entries_table(): void
    {
        $store = Store::query()->create([
            'id' => 'store-no-sales',
            'name' => '売上テーブルなし',
            'description' => 'Render相当',
            'is_open' => true,
            'current_wait_min' => 5,
            'current_queue_count' => 0,
        ]);
        $user = User::query()->create([
            'login_id' => 'no-sales-user',
            'password' => Hash::make('password'),
            'store_id' => $store->id,
            'role' => 'store',
        ]);
        Sanctum::actingAs($user);

        Schema::dropIfExists('sales_entries');

        $this->getJson('/api/v1/booth/dashboard')
            ->assertOk()
            ->assertJsonPath('data.id', 'store-no-sales')
            ->assertJsonPath('data.revenue', 0);
    }

    public function test_admin_seeder_creates_login_account(): void
    {
        $this->seed(\Database\Seeders\AdminUserSeeder::class);

        $this->postJson('/api/v1/booth/auth/login', [
            'login_id' => 'admin',
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('role', 'admin');
    }

    public function test_store_user_can_update_booth_type(): void
    {
        $store = $this->createStore();
        MapFacilities::query()->create([
            'store_id' => $store->id,
            'name' => $store->name,
            'type' => 'booth',
            'floor' => 1,
            'x' => 50,
            'y' => 50,
        ]);
        Sanctum::actingAs($this->createStoreUser($store));

        $this->patchJson("/api/v1/booth/dashboard/{$store->id}", [
            'name' => $store->name,
            'description' => $store->description,
            'current_wait_min' => 5,
            'is_open' => true,
            'type' => 'food',
        ])
            ->assertOk()
            ->assertJsonPath('data.attributes.type', 'food');

        $this->assertDatabaseHas('map_facilities', [
            'store_id' => $store->id,
            'type' => 'food',
        ]);
    }

    public function test_store_user_can_manage_menu_items(): void
    {
        $store = $this->createStore();
        Sanctum::actingAs($this->createStoreUser($store));

        $created = $this->postJson('/api/v1/booth/accounting/menu-items', [
            'name' => '焼きそば',
            'price' => 400,
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', '焼きそば')
            ->assertJsonPath('data.price', 400);

        $id = $created->json('data.id');

        $this->patchJson("/api/v1/booth/accounting/menu-items/{$id}", [
            'name' => '焼きそば大盛',
            'price' => 500,
        ])
            ->assertOk()
            ->assertJsonPath('data.name', '焼きそば大盛')
            ->assertJsonPath('data.price', 500);

        $this->getJson('/api/v1/booth/accounting/menu-items')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->deleteJson("/api/v1/booth/accounting/menu-items/{$id}")
            ->assertNoContent();

        $this->getJson('/api/v1/booth/accounting/menu-items')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_deleting_ordered_menu_item_hides_it(): void
    {
        $store = $this->createStore();
        Sanctum::actingAs($this->createStoreUser($store));
        $item = MenuItem::query()->create([
            'store_id' => $store->id,
            'name' => 'ブレンドコーヒー',
            'description' => 'ホット',
            'price' => 350,
            'is_available' => true,
        ]);
        $order = Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-160',
            'total_price' => 350,
            'status' => 'issued',
            'ordered_at' => now(),
        ]);
        OrderItem::query()->create([
            'order_id' => $order->id,
            'menu_item_id' => $item->id,
            'quantity' => 1,
            'unit_price' => 350,
            'subtotal' => 350,
        ]);

        $this->deleteJson("/api/v1/booth/accounting/menu-items/{$item->id}")
            ->assertNoContent();

        $this->assertDatabaseHas('menu_items', [
            'id' => $item->id,
            'is_available' => false,
        ]);
        $this->getJson('/api/v1/booth/accounting/menu-items')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
