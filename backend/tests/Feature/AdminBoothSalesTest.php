<?php

namespace Tests\Feature;

use App\Models\FestivalSetting;
use App\Models\Order;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBoothSalesTest extends TestCase
{
    use RefreshDatabase;

    public function test_booth_sales_require_admin(): void
    {
        $this->getJson('/api/v1/admin/analytics/booth')->assertUnauthorized();

        $store = $this->createStore('store-a', 'カフェ');
        Sanctum::actingAs($this->createStoreUser($store));

        $this->getJson('/api/v1/admin/analytics/booth')->assertForbidden();
    }

    public function test_admin_sees_settled_sales_by_festival_day_sorted_by_amount(): void
    {
        $cafe = $this->createStore('store-cafe', 'カフェ');
        $noodle = $this->createStore('store-noodle', '焼きそば');
        $quiet = $this->createStore('store-quiet', 'まだ会計なし');

        $this->order($cafe, 'C-1', 1000, 'settled', 'day1');
        $this->order($cafe, 'C-2', 500, 'settled', 'day1');
        $this->order($cafe, 'C-3', 9999, 'issued', 'day1');
        $this->order($cafe, 'C-4', 100, 'settled', null);
        $this->order($noodle, 'Y-1', 2000, 'settled', 'day1');
        $this->order($noodle, 'Y-2', 300, 'settled', 'day2');
        $this->order($quiet, 'Q-1', 800, 'issued', 'day1');

        Sanctum::actingAs($this->createAdmin());

        $this->getJson('/api/v1/admin/analytics/booth?day=day1')
            ->assertOk()
            ->assertJsonPath('data.day', 'day1')
            ->assertJsonPath('data.total_revenue', 3500)
            ->assertJsonPath('data.settled_orders', 3)
            ->assertJsonPath('data.average_ticket', 1167)
            ->assertJsonCount(2, 'data.stores')
            ->assertJsonPath('data.stores.0.store_id', 'store-noodle')
            ->assertJsonPath('data.stores.0.revenue', 2000)
            ->assertJsonPath('data.stores.0.settled_orders', 1)
            ->assertJsonPath('data.stores.0.average_ticket', 2000)
            ->assertJsonPath('data.stores.1.store_id', 'store-cafe')
            ->assertJsonPath('data.stores.1.revenue', 1500)
            ->assertJsonPath('data.stores.1.settled_orders', 2)
            ->assertJsonPath('data.stores.1.average_ticket', 750);

        $this->getJson('/api/v1/admin/analytics/booth?day=day2')
            ->assertOk()
            ->assertJsonPath('data.total_revenue', 300)
            ->assertJsonPath('data.settled_orders', 1)
            ->assertJsonPath('data.average_ticket', 300)
            ->assertJsonPath('data.stores.0.store_name', '焼きそば');

        $this->getJson('/api/v1/admin/analytics/booth?day=all')
            ->assertOk()
            ->assertJsonPath('data.total_revenue', 3900)
            ->assertJsonPath('data.settled_orders', 5)
            ->assertJsonPath('data.average_ticket', 780)
            ->assertJsonPath('data.stores.0.store_id', 'store-noodle')
            ->assertJsonPath('data.stores.0.revenue', 2300)
            ->assertJsonPath('data.stores.0.settled_orders', 2)
            ->assertJsonPath('data.stores.0.average_ticket', 1150)
            ->assertJsonPath('data.stores.1.store_id', 'store-cafe')
            ->assertJsonPath('data.stores.1.revenue', 1600)
            ->assertJsonPath('data.stores.1.settled_orders', 3)
            ->assertJsonPath('data.stores.1.average_ticket', 533);

        $this->getJson('/api/v1/admin/analytics/booth')
            ->assertOk()
            ->assertJsonPath('data.day', 'all')
            ->assertJsonPath('data.total_revenue', 3900);

        $this->getJson('/api/v1/admin/analytics/booth?day=day3')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_PARAMS');
    }

    public function test_new_order_keeps_the_festival_day_it_was_taken_on(): void
    {
        $store = $this->createStore('store-cafe', 'カフェ');
        FestivalSetting::setCurrentDay('day2');

        $order = Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => 'C-9',
            'total_price' => 400,
            'status' => 'issued',
            'ordered_at' => now(),
        ]);

        $this->assertSame('day2', $order->festival_day);

        FestivalSetting::setCurrentDay('day1');
        $order->festival_day = null;
        $order->save();

        Sanctum::actingAs($this->createStoreUser($store));
        $this->patchJson("/api/v1/booth/accounting/orders/{$order->id}/settle")
            ->assertOk();

        $this->assertSame('day1', $order->fresh()->festival_day);
    }

    private function createStore(string $id, string $name): Store
    {
        return Store::query()->create([
            'id' => $id,
            'name' => $name,
            'description' => 'テスト',
            'ticket_prefix' => 'T',
            'is_open' => true,
            'is_visible' => true,
            'current_wait_min' => 0,
            'current_queue_count' => 0,
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

    private function createStoreUser(Store $store): User
    {
        return User::query()->create([
            'login_id' => $store->id.'-user',
            'password' => Hash::make('password123'),
            'store_id' => $store->id,
            'role' => 'store',
        ]);
    }

    private function order(Store $store, string $ticket, int $price, string $status, ?string $day): Order
    {
        $order = Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => $ticket,
            'total_price' => $price,
            'status' => $status,
            'festival_day' => $day,
            'ordered_at' => now(),
            'settled_at' => $status === 'settled' ? now() : null,
        ]);

        // 作成時は開催日が自動で入る。null は「開催日が付いていない過去の精算」。
        if ($day === null) {
            $order->festival_day = null;
            $order->save();
        }

        return $order;
    }
}
