<?php

namespace Tests\Feature;

use App\Models\FestivalSetting;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
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

    public function test_admin_sees_counts_unserved_amounts_hourly_counts_and_menu_ranking(): void
    {
        $cafe = $this->createStore('store-cafe', 'カフェ');
        $noodle = $this->createStore('store-noodle', '焼きそば');
        $this->createStore('store-quiet', 'まだ会計なし');

        $coffee = $this->menu($cafe, 'コーヒー', 300);
        $cake = $this->menu($cafe, 'ケーキ', 400);
        $juice = $this->menu($cafe, 'ジュース', 200);
        $tea = $this->menu($cafe, '紅茶', 180);
        $fried = $this->menu($noodle, '唐揚げ', 300);
        $yakisoba = $this->menu($noodle, '焼きそば', 500);
        $noodleCoffee = $this->menu($noodle, 'コーヒー', 250);
        $salad = $this->menu($noodle, 'サラダ', 600);

        $this->withItems($this->order($cafe, 'C-1', 900, 'settled', 'day1', '2026-10-24 00:30:00', '2026-10-24 00:45:00'), [
            [$coffee, 3, 900],
        ]);
        $this->withItems($this->order($cafe, 'C-2', 800, 'settled', 'day1', '2026-10-24 01:10:00'), [
            [$cake, 2, 800],
        ]);
        $this->withItems($this->order($cafe, 'C-3', 200, 'settled', 'day1', '2026-10-24 04:20:00'), [
            [$juice, 1, 200],
        ]);
        $this->withItems($this->order($cafe, 'C-4', 2700, 'canceled', 'day1', '2026-10-24 01:00:00'), [
            [$coffee, 9, 2700],
        ]);
        $this->withItems($this->order($cafe, 'C-5', 900, 'settled', 'day2', '2026-10-25 01:00:00'), [
            [$tea, 5, 900],
        ]);
        $this->withItems($this->order($noodle, 'Y-1', 3000, 'settled', 'day1', '2026-10-24 00:10:00', '2026-10-24 00:25:00'), [
            [$fried, 10, 3000],
        ]);
        $this->withItems($this->order($noodle, 'Y-2', 3100, 'settled', 'day1', '2026-10-24 02:00:00'), [
            [$yakisoba, 4, 2000],
            [$noodleCoffee, 2, 500],
            [$salad, 1, 600],
        ]);

        Sanctum::actingAs($this->createAdmin());

        $day1 = $this->getJson('/api/v1/admin/analytics/booth?day=day1')
            ->assertOk()
            ->assertJsonPath('data.status_counts.0.store_name', 'まだ会計なし')
            ->assertJsonPath('data.status_counts.0.served', 0)
            ->assertJsonPath('data.status_counts.0.unserved', 0)
            ->assertJsonPath('data.status_counts.0.canceled', 0)
            ->assertJsonPath('data.status_counts.1.store_name', 'カフェ')
            ->assertJsonPath('data.status_counts.1.served', 1)
            ->assertJsonPath('data.status_counts.1.unserved', 2)
            ->assertJsonPath('data.status_counts.1.canceled', 1)
            ->assertJsonPath('data.status_counts.2.store_name', '焼きそば')
            ->assertJsonPath('data.status_counts.2.served', 1)
            ->assertJsonPath('data.status_counts.2.unserved', 1)
            ->assertJsonPath('data.status_counts.2.canceled', 0)
            ->assertJsonPath('data.unserved.0.store_name', '焼きそば')
            ->assertJsonPath('data.unserved.0.count', 1)
            ->assertJsonPath('data.unserved.0.amount', 3100)
            ->assertJsonPath('data.unserved.1.store_name', 'カフェ')
            ->assertJsonPath('data.unserved.1.count', 2)
            ->assertJsonPath('data.unserved.1.amount', 1000)
            ->assertJsonCount(2, 'data.unserved')
            ->assertJsonPath('data.hourly.0.hour', 9)
            ->assertJsonPath('data.hourly.0.count', 2)
            ->assertJsonPath('data.hourly.1.hour', 10)
            ->assertJsonPath('data.hourly.1.count', 1)
            ->assertJsonPath('data.hourly.2.hour', 11)
            ->assertJsonPath('data.hourly.2.count', 1)
            ->assertJsonPath('data.hourly.3.hour', 12)
            ->assertJsonPath('data.hourly.3.count', 0)
            ->assertJsonPath('data.hourly.4.hour', 13)
            ->assertJsonPath('data.hourly.4.count', 1)
            ->assertJsonPath('data.menu_ranking.0.name', '唐揚げ')
            ->assertJsonPath('data.menu_ranking.0.store_names.0', '焼きそば')
            ->assertJsonCount(1, 'data.menu_ranking.0.store_names')
            ->assertJsonPath('data.menu_ranking.0.quantity', 10)
            ->assertJsonPath('data.menu_ranking.0.amount', 3000)
            ->assertJsonPath('data.menu_ranking.1.name', 'コーヒー')
            ->assertJsonPath('data.menu_ranking.1.store_names.0', 'カフェ')
            ->assertJsonPath('data.menu_ranking.1.store_names.1', '焼きそば')
            ->assertJsonPath('data.menu_ranking.1.quantity', 5)
            ->assertJsonPath('data.menu_ranking.1.amount', 1400)
            ->assertJsonPath('data.menu_ranking.2.name', '焼きそば')
            ->assertJsonPath('data.menu_ranking.3.name', 'ケーキ')
            ->assertJsonPath('data.menu_ranking.4.name', 'サラダ')
            ->assertJsonPath('data.menu_ranking.4.quantity', 1)
            ->assertJsonPath('data.menu_ranking.4.amount', 600)
            ->assertJsonCount(5, 'data.menu_ranking')
            ->assertJsonPath('data.store_menu_rankings.0.store_name', 'カフェ')
            ->assertJsonPath('data.store_menu_rankings.0.items.0.name', 'コーヒー')
            ->assertJsonPath('data.store_menu_rankings.0.items.0.quantity', 3)
            ->assertJsonPath('data.store_menu_rankings.0.items.2.name', 'ジュース')
            ->assertJsonPath('data.store_menu_rankings.1.store_name', '焼きそば')
            ->assertJsonPath('data.store_menu_rankings.1.items.0.name', '唐揚げ')
            ->assertJsonCount(2, 'data.store_menu_rankings');

        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/',
            (string) $day1->json('data.generated_at'),
        );

        $this->getJson('/api/v1/admin/analytics/booth?day=all')
            ->assertOk()
            ->assertJsonPath('data.unserved.0.store_name', '焼きそば')
            ->assertJsonPath('data.unserved.0.amount', 3100)
            ->assertJsonPath('data.unserved.1.store_name', 'カフェ')
            ->assertJsonPath('data.unserved.1.count', 3)
            ->assertJsonPath('data.unserved.1.amount', 1900)
            ->assertJsonPath('data.hourly.1.hour', 10)
            ->assertJsonPath('data.hourly.1.count', 2)
            ->assertJsonPath('data.menu_ranking.1.name', 'コーヒー')
            ->assertJsonPath('data.menu_ranking.1.quantity', 5)
            ->assertJsonPath('data.menu_ranking.1.amount', 1400)
            ->assertJsonPath('data.menu_ranking.2.name', '紅茶')
            ->assertJsonPath('data.menu_ranking.2.store_names.0', 'カフェ')
            ->assertJsonPath('data.menu_ranking.2.quantity', 5)
            ->assertJsonPath('data.menu_ranking.2.amount', 900);

        $this->getJson('/api/v1/admin/analytics/booth?day=day2')
            ->assertOk()
            ->assertJsonPath('data.status_counts.1.store_name', 'カフェ')
            ->assertJsonPath('data.status_counts.1.served', 0)
            ->assertJsonPath('data.status_counts.1.unserved', 1)
            ->assertJsonPath('data.status_counts.1.canceled', 0)
            ->assertJsonCount(1, 'data.unserved')
            ->assertJsonPath('data.unserved.0.amount', 900)
            ->assertJsonPath('data.hourly.0.hour', 10)
            ->assertJsonPath('data.hourly.0.count', 1)
            ->assertJsonPath('data.menu_ranking.0.name', '紅茶')
            ->assertJsonPath('data.menu_ranking.0.quantity', 5)
            ->assertJsonPath('data.menu_ranking.0.amount', 900)
            ->assertJsonCount(1, 'data.store_menu_rankings');
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
            'ticket_prefix' => substr($id, 0, 16),
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

    private function order(
        Store $store,
        string $ticket,
        int $price,
        string $status,
        ?string $day,
        ?string $orderedAt = null,
        ?string $servedAt = null,
    ): Order {
        $order = Order::query()->create([
            'store_id' => $store->id,
            'ticket_number' => $ticket,
            'total_price' => $price,
            'status' => $status,
            'festival_day' => $day,
            'ordered_at' => $orderedAt ?? now(),
            'served_at' => $servedAt,
            'settled_at' => $status === 'settled' ? now() : null,
        ]);

        // 作成時は開催日が自動で入る。null は「開催日が付いていない過去の精算」。
        if ($day === null) {
            $order->festival_day = null;
            $order->save();
        }

        return $order;
    }

    private function menu(Store $store, string $name, int $price): MenuItem
    {
        return MenuItem::query()->create([
            'store_id' => $store->id,
            'name' => $name,
            'description' => null,
            'price' => $price,
            'is_available' => true,
        ]);
    }

    /**
     * @param  list<array{0: MenuItem, 1: int, 2: int}>  $items
     */
    private function withItems(Order $order, array $items): void
    {
        foreach ($items as [$item, $quantity, $subtotal]) {
            OrderItem::query()->create([
                'order_id' => $order->id,
                'menu_item_id' => $item->id,
                'quantity' => $quantity,
                'unit_price' => $item->price,
                'subtotal' => $subtotal,
            ]);
        }
    }
}
