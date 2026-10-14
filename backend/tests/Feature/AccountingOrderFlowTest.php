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
    // 売り切れ
    // ------------------------------------------------------------------

    public function test_menu_item_can_be_marked_sold_out_and_back(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $this->getJson('/api/v1/booth/accounting/menu-items')
            ->assertOk()
            ->assertJsonPath('data.0.is_sold_out', false);

        $this->patchJson("/api/v1/booth/accounting/menu-items/{$coffee->id}/sold-out", ['is_sold_out' => true])
            ->assertOk()
            ->assertJsonPath('data.is_sold_out', true);

        // 売り切れでもメニュー一覧からは消えない
        $this->getJson('/api/v1/booth/accounting/menu-items')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.is_sold_out', true);

        $this->patchJson("/api/v1/booth/accounting/menu-items/{$coffee->id}/sold-out", ['is_sold_out' => false])
            ->assertOk()
            ->assertJsonPath('data.is_sold_out', false);
    }

    public function test_sold_out_flag_must_be_boolean(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $this->patchJson("/api/v1/booth/accounting/menu-items/{$coffee->id}/sold-out", ['is_sold_out' => 'maybe'])
            ->assertStatus(422);
        $this->patchJson("/api/v1/booth/accounting/menu-items/{$coffee->id}/sold-out", [])
            ->assertStatus(422);

        $this->assertFalse($coffee->fresh()->is_sold_out);
    }

    public function test_sold_out_item_cannot_be_ordered(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $toast = $this->createMenuItem($store, 'トースト', 250);
        $this->loginAsStore($store);

        $this->patchJson("/api/v1/booth/accounting/menu-items/{$toast->id}/sold-out", ['is_sold_out' => true])
            ->assertOk();

        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [
                ['menu_item_id' => $coffee->id, 'quantity' => 1],
                ['menu_item_id' => $toast->id, 'quantity' => 1],
            ],
            'settle' => true,
        ])->assertStatus(409)
            ->assertJsonPath('error.code', 'SOLD_OUT')
            ->assertJsonPath('error.details.menu_item_ids', [$toast->id]);

        $this->assertSame(0, Order::query()->count());
        $this->assertSame(0, $store->fresh()->current_queue_count);

        // 売り切れでない商品だけなら注文できる
        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
        ])->assertCreated();
    }

    public function test_sold_out_cannot_be_changed_on_other_store_item(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $other = $this->createStore('store-102', ['name' => '他の店', 'ticket_prefix' => 'B']);

        Sanctum::actingAs($this->createStoreUser($other, 'other_admin'));

        $this->patchJson("/api/v1/booth/accounting/menu-items/{$coffee->id}/sold-out", ['is_sold_out' => true])
            ->assertStatus(404);

        $this->assertFalse($coffee->fresh()->is_sold_out);
    }

    public function test_sold_out_requires_authentication(): void
    {
        $this->patchJson('/api/v1/booth/accounting/menu-items/1/sold-out', ['is_sold_out' => true])
            ->assertStatus(401);
    }

    public function test_visitor_store_api_shows_sold_out_items(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->createMenuItem($store, 'トースト', 250);
        $this->loginAsStore($store);

        $this->patchJson("/api/v1/booth/accounting/menu-items/{$coffee->id}/sold-out", ['is_sold_out' => true])
            ->assertOk();

        $this->getJson("/api/v1/restaurants/{$store->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.menu_items')
            ->assertJsonPath('data.menu_items.0.name', 'コーヒー')
            ->assertJsonPath('data.menu_items.0.is_sold_out', true)
            ->assertJsonPath('data.menu_items.1.is_sold_out', false);
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

    // ------------------------------------------------------------------
    // 受付番号の採番（本番の Postgres でも動く書き方になっているか）
    // ------------------------------------------------------------------

    public function test_first_ticket_number_of_a_store_starts_at_101(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
        ])->assertCreated()
            ->assertJsonPath('data.ticket_number', 'C-101');

        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
        ])->assertCreated()
            ->assertJsonPath('data.ticket_number', 'C-102');
    }

    // ------------------------------------------------------------------
    // キャンセル（提供前の注文）
    // ------------------------------------------------------------------

    public function test_waiting_order_can_be_canceled(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $keep = $this->createOrder($store, $coffee);
        $id = $this->createOrder($store, $coffee);
        $this->assertSame(2, $store->fresh()->current_queue_count);

        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'canceled')
            ->assertJsonPath('data.items.0.name', 'コーヒー');

        // 待ち人数が1人分減り、売上からも外れる
        $this->assertSame(1, $store->fresh()->current_queue_count);
        $this->getJson('/api/v1/booth/dashboard')
            ->assertOk()
            ->assertJsonPath('data.revenue', 300);

        // 呼び出し・提供の対象にもならない
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/call")->assertStatus(409);
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/serve")->assertStatus(409);
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/settle")->assertStatus(409);

        // 他の注文には影響しない
        $this->assertNull(Order::query()->findOrFail($keep)->served_at);
        $this->assertSame('settled', Order::query()->findOrFail($keep)->status);
    }

    public function test_called_order_can_be_canceled_and_disappears_from_call_numbers(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $id = $this->createOrder($store, $coffee);
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/call")->assertOk();

        $this->getJson('/api/v1/call-numbers?store_id=store-101')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'canceled');

        $this->getJson('/api/v1/call-numbers?store_id=store-101')
            ->assertOk()
            ->assertJsonCount(0, 'data');
        $this->assertSame(0, $store->fresh()->current_queue_count);
    }

    public function test_cancel_twice_does_not_reduce_queue_count_twice(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $this->createOrder($store, $coffee);
        $id = $this->createOrder($store, $coffee);
        $this->assertSame(2, $store->fresh()->current_queue_count);

        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/cancel")->assertOk();
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/cancel")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CONFLICT');

        $this->assertSame(1, $store->fresh()->current_queue_count);
    }

    public function test_served_order_cannot_be_canceled(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $this->loginAsStore($store);

        $id = $this->createOrder($store, $coffee);
        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/serve")->assertOk();
        $this->assertSame(0, $store->fresh()->current_queue_count);

        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/cancel")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CONFLICT');

        $this->assertSame('settled', Order::query()->findOrFail($id)->status);
        $this->assertSame(0, $store->fresh()->current_queue_count);
    }

    public function test_cancel_cannot_be_used_on_other_store_order(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);
        $other = $this->createStore('store-102', ['name' => '他の店', 'ticket_prefix' => 'B']);

        $this->loginAsStore($store);
        $id = $this->createOrder($store, $coffee);

        Sanctum::actingAs($this->createStoreUser($other, 'other_admin'));

        $this->patchJson("/api/v1/booth/accounting/orders/{$id}/cancel")->assertStatus(404);

        $this->assertSame('settled', Order::query()->findOrFail($id)->status);
        $this->assertSame(1, $store->fresh()->current_queue_count);
    }

    public function test_cancel_requires_authentication(): void
    {
        $this->patchJson('/api/v1/booth/accounting/orders/1/cancel')->assertStatus(401);
    }

    public function test_ticket_number_continues_after_existing_orders_when_counter_is_missing(): void
    {
        $store = $this->createStore();
        $coffee = $this->createMenuItem($store, 'コーヒー', 300);

        // 古いデータ: 注文はあるが、採番用のカウンターの行がない状態
        foreach (['C-101', 'C-109', 'C-105'] as $number) {
            Order::query()->create([
                'store_id' => $store->id,
                'ticket_number' => $number,
                'total_price' => 300,
                'status' => 'settled',
                'ordered_at' => now(),
                'settled_at' => now(),
            ]);
        }

        $this->loginAsStore($store);

        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
        ])->assertCreated()
            ->assertJsonPath('data.ticket_number', 'C-110');
    }
}
