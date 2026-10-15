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
use Illuminate\Support\Facades\DB;
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

        $this->patchJson('/api/v1/booth/wait-time', [
            'current_wait_min' => 20,
            'current_queue_count' => 10,
            'wait_display_mode' => 'text',
            'wait_display_text' => '13時開始',
        ])
            ->assertOk()
            ->assertJsonPath('data.id', $store->id)
            ->assertJsonPath('data.current_wait_min', 20)
            ->assertJsonPath('data.current_queue_count', 10)
            ->assertJsonPath('data.wait_display_mode', 'text')
            ->assertJsonPath('data.wait_display_text', '13時開始');
    }

    public function test_admin_cannot_update_booth_wait_time(): void
    {
        $this->createStore();
        Sanctum::actingAs($this->createAdmin());

        $this->patchJson('/api/v1/booth/wait-time', [
            'current_wait_min' => 20,
            'current_queue_count' => 10,
        ])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_admin_can_update_store_wait_time(): void
    {
        $store = $this->createStore();
        Sanctum::actingAs($this->createAdmin());

        $this->patchJson("/api/v1/admin/stores/{$store->id}/wait-time", [
            'current_wait_min' => 25,
            'current_queue_count' => 12,
            'wait_display_mode' => 'text',
            'wait_display_text' => '整理券配布中',
        ])
            ->assertOk()
            ->assertJsonPath('data.id', $store->id)
            ->assertJsonPath('data.current_wait_min', 25)
            ->assertJsonPath('data.current_queue_count', 12)
            ->assertJsonPath('data.wait_display_mode', 'text')
            ->assertJsonPath('data.wait_display_text', '整理券配布中');

        $this->assertDatabaseHas('stores', [
            'id' => $store->id,
            'current_wait_min' => 25,
            'current_queue_count' => 12,
        ]);
    }

    public function test_store_user_cannot_update_admin_store_wait_time(): void
    {
        $store = $this->createStore();
        Sanctum::actingAs($this->createStoreUser($store));

        $this->patchJson("/api/v1/admin/stores/{$store->id}/wait-time", [
            'current_wait_min' => 25,
            'current_queue_count' => 12,
        ])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
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

    public function test_future_dated_events_are_listed(): void
    {
        EventNotice::query()->create([
            'title' => '2日目のライブ',
            'body' => '開催日はまだ先',
            'type' => 'event',
            'starts_at' => now()->addDays(30),
            'ends_at' => null,
            'is_published' => true,
        ]);

        $this->getJson('/api/v1/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', '2日目のライブ');
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
        config(['admin.login_id' => 'admin', 'admin.password' => 'password']);
        $this->seed(\Database\Seeders\AdminUserSeeder::class);

        $this->postJson('/api/v1/booth/auth/login', [
            'login_id' => 'admin',
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('role', 'admin');
    }

    public function test_admin_seeder_skips_without_credentials(): void
    {
        config(['admin.login_id' => null, 'admin.password' => null]);
        $this->seed(\Database\Seeders\AdminUserSeeder::class);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_admin_seeder_does_not_overwrite_existing_password(): void
    {
        User::query()->create([
            'login_id' => 'admin',
            'password' => Hash::make('already-set'),
            'store_id' => null,
            'role' => 'admin',
        ]);
        config(['admin.login_id' => 'admin', 'admin.password' => 'password']);

        $this->seed(\Database\Seeders\AdminUserSeeder::class);

        $this->postJson('/api/v1/admin/auth/login', [
            'login_id' => 'admin',
            'password' => 'already-set',
        ])->assertOk();

        $this->postJson('/api/v1/admin/auth/login', [
            'login_id' => 'admin',
            'password' => 'password',
        ])->assertUnauthorized();
    }

    public function test_database_seeder_skips_demo_users_in_production(): void
    {
        $this->app['env'] = 'production';
        config(['admin.login_id' => 'admin', 'admin.password' => 'secret-admin']);

        $this->artisan('db:seed', ['--force' => true])->assertSuccessful();

        $this->assertDatabaseHas('users', ['login_id' => 'admin', 'role' => 'admin']);
        $this->assertDatabaseMissing('users', ['login_id' => 'testuser']);
        $this->assertDatabaseMissing('users', ['login_id' => 'testuser2']);
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('stores', 0);
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

    public function test_admin_can_permanently_delete_store_with_related_data(): void
    {
        $store = $this->createStore();
        $other = $this->createStore('store-102', ['name' => '焼きそば', 'ticket_prefix' => 'Y']);
        $this->createStoreUser($store);
        $this->createStoreUser($other, 'yakisoba_admin');
        MapFacilities::query()->create([
            'store_id' => $store->id,
            'name' => $store->name,
            'type' => 'booth',
            'floor' => 1,
            'x' => 50,
            'y' => 50,
        ]);
        $item = MenuItem::query()->create([
            'store_id' => $store->id,
            'name' => 'ブレンドコーヒー',
            'description' => 'ホット',
            'price' => 350,
            'is_available' => true,
        ]);
        $order = Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-170',
            'total_price' => 350,
            'status' => 'settled',
            'ordered_at' => now(),
            'settled_at' => now(),
        ]);
        OrderItem::query()->create([
            'order_id' => $order->id,
            'menu_item_id' => $item->id,
            'quantity' => 1,
            'unit_price' => 350,
            'subtotal' => 350,
        ]);
        SalesEntry::query()->create([
            'store_id' => $store->id,
            'amount' => 1000,
            'recorded_at' => now(),
        ]);
        Order::query()->create([
            'store_id' => $other->id,
            'ticket_number' => 'Y-001',
            'total_price' => 500,
            'status' => 'issued',
            'ordered_at' => now(),
        ]);
        Sanctum::actingAs($this->createAdmin());

        $this->deleteJson("/api/v1/admin/stores/{$store->id}/permanent")
            ->assertNoContent();

        $this->assertDatabaseMissing('stores', ['id' => $store->id]);
        $this->assertDatabaseMissing('menu_items', ['store_id' => $store->id]);
        $this->assertDatabaseMissing('orders', ['store_id' => $store->id]);
        $this->assertDatabaseMissing('order_items', ['order_id' => $order->id]);
        $this->assertDatabaseMissing('sales_entries', ['store_id' => $store->id]);
        $this->assertDatabaseMissing('map_facilities', ['store_id' => $store->id]);
        $this->assertDatabaseMissing('users', ['login_id' => 'cafe_admin']);

        // 他の店舗のデータは残る
        $this->assertDatabaseHas('stores', ['id' => $other->id]);
        $this->assertDatabaseHas('users', ['login_id' => 'yakisoba_admin']);
        $this->assertDatabaseHas('orders', ['store_id' => $other->id]);
    }

    public function test_permanent_store_delete_requires_admin_role(): void
    {
        config(['admin.public_access' => false]);
        $store = $this->createStore();
        Sanctum::actingAs($this->createStoreUser($store));

        $this->deleteJson("/api/v1/admin/stores/{$store->id}/permanent")
            ->assertForbidden();

        $this->assertDatabaseHas('stores', ['id' => $store->id]);
    }

    public function test_admin_endpoints_require_authentication(): void
    {
        $store = $this->createStore();

        $this->getJson('/api/v1/admin/stores')->assertUnauthorized();
        $this->getJson("/api/v1/admin/stores/{$store->id}")->assertUnauthorized();
        $this->patchJson("/api/v1/admin/stores/{$store->id}", ['name' => '乗っ取り'])->assertUnauthorized();
        $this->deleteJson("/api/v1/admin/stores/{$store->id}")->assertUnauthorized();
        $this->deleteJson("/api/v1/admin/stores/{$store->id}/permanent")->assertUnauthorized();
        $this->getJson('/api/v1/admin/analytics')->assertUnauthorized();
        $this->getJson('/api/v1/admin/revenue')->assertUnauthorized();
        $this->deleteJson('/api/v1/admin/analytics')->assertUnauthorized();
    }

    public function test_admin_endpoints_require_authentication_even_when_public_access_is_enabled(): void
    {
        config(['admin.public_access' => true]);
        $store = $this->createStore();

        $this->getJson('/api/v1/admin/stores')->assertUnauthorized();
        $this->deleteJson("/api/v1/admin/stores/{$store->id}/permanent")->assertUnauthorized();
        $this->deleteJson('/api/v1/admin/analytics')->assertUnauthorized();
    }

    public function test_store_user_cannot_use_admin_apis_even_when_public_access_is_enabled(): void
    {
        config(['admin.public_access' => true]);
        $store = $this->createStore();
        Sanctum::actingAs($this->createStoreUser($store));

        $this->getJson('/api/v1/admin/stores')->assertForbidden();
        $this->patchJson("/api/v1/admin/stores/{$store->id}", [
            'login_id' => 'hijacked',
            'password' => 'stolen',
        ])->assertForbidden();
        $this->deleteJson("/api/v1/admin/stores/{$store->id}/permanent")->assertForbidden();
        $this->deleteJson('/api/v1/admin/analytics')->assertForbidden();
    }

    public function test_admin_can_reset_sales_data(): void
    {
        $store = $this->createStore('store-101', ['current_queue_count' => 3]);
        $other = $this->createStore('store-102', ['name' => 'やきそば', 'ticket_prefix' => 'Y']);
        $this->createStoreUser($store);
        $item = MenuItem::query()->create([
            'store_id' => $store->id,
            'name' => 'ブレンドコーヒー',
            'description' => 'ホット',
            'price' => 350,
            'is_available' => true,
        ]);
        $order = Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-101',
            'total_price' => 350,
            'status' => 'settled',
            'ordered_at' => now(),
            'settled_at' => now(),
        ]);
        OrderItem::query()->create([
            'order_id' => $order->id,
            'menu_item_id' => $item->id,
            'quantity' => 1,
            'unit_price' => 350,
            'subtotal' => 350,
        ]);
        Order::query()->create([
            'store_id' => $other->id,
            'ticket_number' => 'Y-101',
            'total_price' => 500,
            'status' => 'issued',
            'ordered_at' => now(),
        ]);
        SalesEntry::query()->create([
            'store_id' => $store->id,
            'amount' => 1000,
            'recorded_at' => now(),
        ]);
        DB::table('ticket_counters')->insert([
            'store_id' => $store->id,
            'last_number' => 101,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Sanctum::actingAs($this->createAdmin());

        $this->deleteJson('/api/v1/admin/analytics')
            ->assertOk()
            ->assertJsonPath('data.orders', 2)
            ->assertJsonPath('data.sales_entries', 1);

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertDatabaseCount('sales_entries', 0);
        $this->assertDatabaseCount('ticket_counters', 0);
        $this->assertSame(0, (int) Store::query()->find($store->id)->current_queue_count);

        // 店舗・メニュー・ログインアカウントは消さない
        $this->assertDatabaseHas('stores', ['id' => $store->id]);
        $this->assertDatabaseHas('stores', ['id' => $other->id]);
        $this->assertDatabaseHas('menu_items', ['id' => $item->id]);
        $this->assertDatabaseHas('users', ['login_id' => 'cafe_admin']);

        $this->getJson('/api/v1/admin/analytics')
            ->assertOk()
            ->assertJsonPath('data.total_revenue', 0)
            ->assertJsonPath('data.total_orders', 0)
            ->assertJsonPath('data.settled_orders', 0);
    }

    public function test_reset_sales_data_requires_admin_role(): void
    {
        config(['admin.public_access' => false]);
        $store = $this->createStore();
        Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-101',
            'total_price' => 350,
            'status' => 'settled',
            'ordered_at' => now(),
            'settled_at' => now(),
        ]);
        Sanctum::actingAs($this->createStoreUser($store));

        $this->deleteJson('/api/v1/admin/analytics')->assertForbidden();

        $this->assertDatabaseCount('orders', 1);
    }

    private function createTickerEvent(string $title, $startsAt, ?int $lead, ?int $after = null, bool $published = true): EventNotice
    {
        return EventNotice::query()->create([
            'title' => $title,
            'body' => '詳細',
            'type' => 'event',
            'starts_at' => $startsAt,
            'is_published' => $published,
            'ticker_lead_minutes' => $lead,
            'ticker_after_minutes' => $after,
        ]);
    }

    public function test_ticker_returns_events_inside_their_window(): void
    {
        $this->travelTo(now()->setTime(5, 0)); // 14:00 JST の開始 = 05:00 UTC

        // 開始の10分前〜開始の20分後（既定）
        $this->createTickerEvent('ゲスト登壇', now(), 10);
        // まだ早い（開始の1時間後が開始、10分前から）
        $this->createTickerEvent('まだ先', now()->addHour(), 10);
        // 終わった（開始の1時間前、流すのは開始20分後まで）
        $this->createTickerEvent('終了済み', now()->subHour(), 10);
        // 掲示板に流さない設定
        $this->createTickerEvent('流さない', now(), null);
        // 非公開
        $this->createTickerEvent('非公開', now(), 10, null, false);

        $this->getJson('/api/v1/ticker')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'ゲスト登壇');
    }

    public function test_ticker_window_edges_and_custom_after_minutes(): void
    {
        $this->travelTo(now()->setTime(5, 0));
        $this->createTickerEvent('10分前から', now()->addMinutes(10), 10);
        $this->createTickerEvent('11分前から', now()->addMinutes(11), 10);
        $this->createTickerEvent('5分後まで', now()->subMinutes(5), 0, 5);
        $this->createTickerEvent('6分後まで', now()->subMinutes(6), 0, 5);

        $titles = collect($this->getJson('/api/v1/ticker')->assertOk()->json('data'))->pluck('title');

        $this->assertEqualsCanonicalizing(['10分前から', '5分後まで'], $titles->all());
    }

    public function test_ticker_is_empty_without_active_events(): void
    {
        $this->getJson('/api/v1/ticker')
            ->assertOk()
            ->assertExactJson(['data' => []]);
    }

    public function test_admin_can_save_ticker_settings_on_event(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $response = $this->postJson('/api/v1/admin/events', [
            'title' => 'YouTubeゲスト',
            'body' => '14:00から登壇',
            'type' => 'event',
            'starts_at' => '2026-10-24T05:00:00Z',
            'ticker_lead_minutes' => 10,
            'ticker_after_minutes' => 30,
        ])->assertCreated()
            ->assertJsonPath('data.attributes.ticker_lead_minutes', 10);

        $id = $response->json('data.id') ?? $response->json('id');

        $this->patchJson("/api/v1/admin/events/{$id}", ['ticker_lead_minutes' => null])
            ->assertOk();

        $this->assertDatabaseHas('event_notices', [
            'id' => $id,
            'ticker_lead_minutes' => null,
            'ticker_after_minutes' => 30,
        ]);
    }

    public function test_notice_can_be_sent_to_ticker_immediately_and_stopped(): void
    {
        $this->travelTo(now()->setTime(5, 0));
        Sanctum::actingAs($this->createAdmin());
        $this->createTickerEvent('ゲスト登壇', now(), 10);

        $response = $this->postJson('/api/v1/admin/events', [
            'title' => '雨天のお知らせ',
            'body' => '中庭の企画は体育館に変更します',
            'type' => 'notice',
            'ticker_now' => true,
            'ticker_after_minutes' => 30,
        ])->assertCreated()
            ->assertJsonPath('data.attributes.ticker_active', true);
        $id = $response->json('data.id');

        // お知らせを先に、時刻なしで流す
        $this->getJson('/api/v1/ticker')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.title', '雨天のお知らせ')
            ->assertJsonPath('data.0.starts_at', null)
            ->assertJsonPath('data.1.title', 'ゲスト登壇');

        // 流している途中に文面を直しても、流し始めた時刻は変わらない
        $this->travel(20)->minutes();
        $this->patchJson("/api/v1/admin/events/{$id}", ['body' => '中庭の企画は体育館で行います', 'ticker_now' => true])
            ->assertOk();
        $this->travel(11)->minutes();
        $this->assertNotContains('雨天のお知らせ', collect($this->getJson('/api/v1/ticker')->json('data'))->pluck('title'));

        // もう一度流すと、いまから流し直す
        $this->patchJson("/api/v1/admin/events/{$id}", ['ticker_now' => true])
            ->assertOk()
            ->assertJsonPath('data.attributes.ticker_active', true);

        // 止める
        $this->patchJson("/api/v1/admin/events/{$id}", ['ticker_now' => false])
            ->assertOk()
            ->assertJsonPath('data.attributes.ticker_active', false);
        $this->assertDatabaseHas('event_notices', ['id' => $id, 'ticker_started_at' => null]);
    }

    public function test_notice_ticker_without_duration_runs_until_stopped(): void
    {
        $this->travelTo(now()->setTime(5, 0));
        Sanctum::actingAs($this->createAdmin());

        $this->postJson('/api/v1/admin/events', [
            'title' => '迷子のお知らせ',
            'body' => '1F総合案内でお預かりしています',
            'type' => 'notice',
            'ticker_now' => true,
            'ticker_after_minutes' => null,
        ])->assertCreated();

        $this->travel(10)->hours();
        $this->getJson('/api/v1/ticker')->assertOk()->assertJsonPath('data.0.title', '迷子のお知らせ');
    }

    public function test_unpublished_notice_is_not_sent_to_ticker(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $this->postJson('/api/v1/admin/events', [
            'title' => '下書き',
            'body' => 'まだ出さない',
            'type' => 'notice',
            'is_published' => false,
            'ticker_now' => true,
        ])->assertCreated();

        $this->getJson('/api/v1/ticker')->assertOk()->assertExactJson(['data' => []]);
    }
}
