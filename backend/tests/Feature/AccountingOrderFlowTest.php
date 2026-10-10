<?php

namespace Tests\Feature;

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountingOrderFlowTest extends TestCase
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
            'current_wait_min' => 3,
            'current_queue_count' => 0,
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

    private function createMenuItem(Store $store, string $name, int $price, bool $available = true): MenuItem
    {
        return MenuItem::query()->create([
            'store_id' => $store->id,
            'name' => $name,
            'description' => null,
            'price' => $price,
            'is_available' => $available,
        ]);
    }

    private function loginAsStore(Store $store): void
    {
        Sanctum::actingAs($this->createStoreUser($store));
    }

    // ------------------------------------------------------------------
    // 商品名
    // ------------------------------------------------------------------

    public function test_order_response_includes_item_names(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $created = $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 2]],
        ])->assertCreated()
            ->assertJsonPath('data.items.0.name', 'コーヒー');

        $id = $created->json('data.id');

        $this->getJson('/api/v1/booth/accounting/orders')
            ->assertOk()
            ->assertJsonPath('data.0.items.0.name', 'コーヒー');

        $this->getJson("/api/v1/booth/accounting/orders/{$id}")
            ->assertOk()
            ->assertJsonPath('data.items.0.name', 'コーヒー');

        $this->getJson('/api/v1/booth/accounting/orders/ticket/'.$created->json('data.ticket_number'))
            ->assertOk()
            ->assertJsonPath('data.items.0.name', 'コーヒー');
    }

    public function test_item_name_is_still_returned_after_menu_item_is_made_unavailable(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $orderId = $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
        ])->assertCreated()->json('data.id');

        // 注文済みのメニューを削除すると、販売停止（非表示）になる
        $this->deleteJson("/api/v1/booth/accounting/menu-items/{$coffee->id}")->assertNoContent();
        $this->assertFalse($coffee->fresh()->is_available);

        $this->getJson("/api/v1/booth/accounting/orders/{$orderId}")
            ->assertOk()
            ->assertJsonPath('data.items.0.name', 'コーヒー');

        $this->getJson('/api/v1/booth/accounting/orders')
            ->assertOk()
            ->assertJsonPath('data.0.items.0.name', 'コーヒー');
    }

    // ------------------------------------------------------------------
    // 注文の作成と同時に精算
    // ------------------------------------------------------------------

    public function test_order_without_settle_flag_stays_issued(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
        ])->assertCreated()
            ->assertJsonPath('data.status', 'issued')
            ->assertJsonPath('data.settled_at', null);
    }

    public function test_order_can_be_created_and_settled_at_once(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $toast = $this->createMenuItem($store, 'トースト', 250);
        $this->loginAsStore($store);

        $response = $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [
                ['menu_item_id' => $coffee->id, 'quantity' => 2],
                ['menu_item_id' => $toast->id, 'quantity' => 1],
            ],
            'settle' => true,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'settled')
            ->assertJsonPath('data.total_price', 850);

        $this->assertNotNull($response->json('data.settled_at'));
        $this->assertSame('settled', Order::query()->findOrFail($response->json('data.id'))->status);
        $this->assertSame(1, $store->fresh()->current_queue_count);

        // 売上に反映される
        $this->getJson('/api/v1/booth/dashboard')
            ->assertOk()
            ->assertJsonPath('data.revenue', 850);
    }

    public function test_failure_during_creation_leaves_no_order_and_no_revenue(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        // 明細の保存で失敗させる（注文の作成の途中で失敗した状況）
        OrderItem::creating(function () {
            throw new \RuntimeException('simulated failure');
        });

        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
            'settle' => true,
        ])->assertStatus(500);

        $this->assertSame(0, Order::query()->count());
        $this->assertSame(0, OrderItem::query()->count());
        $this->assertSame(0, $store->fresh()->current_queue_count);

        $this->getJson('/api/v1/booth/dashboard')
            ->assertOk()
            ->assertJsonPath('data.revenue', 0);
    }

    public function test_invalid_item_with_settle_creates_nothing(): void
    {
        $store = $this->createStore();
        $stopped = $this->createMenuItem($store, '販売停止', 100, false);
        $this->loginAsStore($store);

        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $stopped->id, 'quantity' => 1]],
            'settle' => true,
        ])->assertStatus(422);

        $this->assertSame(0, Order::query()->count());
        $this->assertSame(0, $store->fresh()->current_queue_count);
    }

    public function test_settle_flag_must_be_boolean(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
            'settle' => 'maybe',
        ])->assertStatus(422);

        $this->assertSame(0, Order::query()->count());
    }

    // ------------------------------------------------------------------
    // 未提供に戻す
    // ------------------------------------------------------------------

    private function createOrder(Store $store, MenuItem $item): int
    {
        return $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
            'settle' => true,
        ])->assertCreated()->json('data.id');
    }

    public function test_served_order_can_be_returned_to_waiting(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $id = $this->createOrder($store, $coffee);
        $this->assertSame(1, $store->fresh()->current_queue_count);

        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/call")->assertOk();
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/serve")->assertOk()
            ->assertJsonPath('data.items.0.name', 'コーヒー');
        $this->assertSame(0, $store->fresh()->current_queue_count);

        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/unserve")
            ->assertOk()
            ->assertJsonPath('data.served_at', null)
            ->assertJsonPath('data.called_at', null)
            ->assertJsonPath('data.status', 'settled');

        $this->assertSame(1, $store->fresh()->current_queue_count);

        // 売上は変わらない（戻しても精算は取り消さない）
        $this->getJson('/api/v1/booth/dashboard')
            ->assertOk()
            ->assertJsonPath('data.revenue', 300);

        // 戻したあとは、もう一度呼び出し・提供ができる
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/call")->assertOk();
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/serve")->assertOk();
        $this->assertSame(0, $store->fresh()->current_queue_count);
    }

    public function test_unserve_returns_conflict_when_not_served(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $id = $this->createOrder($store, $coffee);

        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/unserve")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CONFLICT');

        // 待ち人数は増えない
        $this->assertSame(1, $store->fresh()->current_queue_count);
    }

    public function test_unserve_cannot_be_used_on_other_store_order(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $other = $this->createStore('store-102', ['name' => '他の店', 'ticket_prefix' => 'B']);

        $this->loginAsStore($store);
        $id = $this->createOrder($store, $coffee);
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/serve")->assertOk();

        Sanctum::actingAs($this->createStoreUser($other, 'other_admin'));

        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/unserve")
            ->assertStatus(404);

        $this->assertNotNull(Order::query()->findOrFail($id)->served_at);
    }

    public function test_unserve_requires_authentication(): void
    {
        $this->patchJson('/api/v1/booth/accounting/orders/1/unserve')->assertStatus(401);
    }

    // ------------------------------------------------------------------
    // 来場者向け: 合計の待ち時間
    // ------------------------------------------------------------------

    public function test_visitor_store_api_includes_estimated_wait_min(): void
    {
        // 待ち人数 4人 × 1人当たり 3分 = 12分
        $store = $this->createStore('store-101', [
            'current_wait_min' => 3,
            'current_queue_count' => 4,
        ]);

        $this->getJson('/api/v1/restaurants')
            ->assertOk()
            ->assertJsonPath('data.0.current_wait_min', 3)
            ->assertJsonPath('data.0.current_queue_count', 4)
            ->assertJsonPath('data.0.estimated_wait_min', 12);

        $this->getJson("/api/v1/restaurants/{$store->id}")
            ->assertOk()
            ->assertJsonPath('data.estimated_wait_min', 12);
    }

    public function test_estimated_wait_min_is_zero_when_nobody_is_waiting(): void
    {
        $this->createStore('store-101', [
            'current_wait_min' => 5,
            'current_queue_count' => 0,
        ]);

        $this->getJson('/api/v1/restaurants')
            ->assertOk()
            ->assertJsonPath('data.0.estimated_wait_min', 0);
    }

    public function test_text_display_mode_keeps_text_available(): void
    {
        $this->createStore('store-101', [
            'current_wait_min' => 3,
            'current_queue_count' => 4,
            'wait_display_mode' => 'text',
            'wait_display_text' => '少し混んでいます',
        ]);

        $this->getJson('/api/v1/restaurants')
            ->assertOk()
            ->assertJsonPath('data.0.wait_display_mode', 'text')
            ->assertJsonPath('data.0.wait_display_text', '少し混んでいます')
            ->assertJsonPath('data.0.estimated_wait_min', 12);
    }

    public function test_estimated_wait_min_follows_the_order_flow(): void
    {
        $store = $this->createStore('store-101', ['current_wait_min' => 4]);
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $first = $this->createOrder($store, $coffee);
        $this->createOrder($store, $coffee);

        $this->getJson('/api/v1/restaurants')->assertJsonPath('data.0.estimated_wait_min', 8);

        $this->patchJson("/api/v1/booth/accounting/orders/{$first}/serve")->assertOk();
        $this->getJson('/api/v1/restaurants')->assertJsonPath('data.0.estimated_wait_min', 4);

        $this->patchJson("/api/v1/booth/accounting/orders/{$first}/unserve")->assertOk();
        $this->getJson('/api/v1/restaurants')->assertJsonPath('data.0.estimated_wait_min', 8);
    }
}
