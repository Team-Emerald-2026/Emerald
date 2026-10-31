<?php

namespace Tests\Feature;

use App\Models\MenuItem;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BoothWaitTimeTest extends TestCase
{
    use RefreshDatabase;

    private function loginAsStore(array $overrides = []): Store
    {
        $store = Store::query()->create(array_merge([
            'id' => 'store-101',
            'name' => 'KTCカフェ',
            'description' => '学園祭限定メニュー',
            'ticket_prefix' => 'C',
            'is_open' => true,
            'is_visible' => true,
            'current_wait_min' => 4,
            'current_queue_count' => 3,
            'wait_display_mode' => 'minutes',
            'wait_display_text' => null,
        ], $overrides));

        Sanctum::actingAs(User::query()->create([
            'login_id' => 'cafe_admin',
            'password' => Hash::make('password123'),
            'store_id' => $store->id,
            'role' => 'store',
        ]));

        return $store;
    }

    public function test_queue_count_can_be_updated_without_wait_minutes(): void
    {
        $store = $this->loginAsStore();

        $this->patchJson('/api/v1/booth/wait-time', ['current_queue_count' => 7])
            ->assertOk()
            ->assertJsonPath('data.current_queue_count', 7)
            ->assertJsonPath('data.current_wait_min', 4);

        $store->refresh();
        $this->assertSame(7, $store->current_queue_count);
        $this->assertSame(4, $store->current_wait_min);
    }

    public function test_wait_minutes_can_be_updated_without_queue_count(): void
    {
        $store = $this->loginAsStore();

        $this->patchJson('/api/v1/booth/wait-time', ['current_wait_min' => 9])
            ->assertOk()
            ->assertJsonPath('data.current_wait_min', 9)
            ->assertJsonPath('data.current_queue_count', 3);

        $this->assertSame(3, $store->fresh()->current_queue_count);
    }

    public function test_queue_count_can_be_changed_by_delta(): void
    {
        $store = $this->loginAsStore();

        $this->patchJson('/api/v1/booth/wait-time', ['current_queue_delta' => 1])
            ->assertOk()
            ->assertJsonPath('data.current_queue_count', 4);

        $this->patchJson('/api/v1/booth/wait-time', ['current_queue_delta' => -2])
            ->assertOk()
            ->assertJsonPath('data.current_queue_count', 2);

        $this->assertSame(2, $store->fresh()->current_queue_count);
        $this->assertSame(4, $store->fresh()->current_wait_min);
    }

    public function test_delta_never_makes_queue_count_negative(): void
    {
        $store = $this->loginAsStore(['current_queue_count' => 1]);

        $this->patchJson('/api/v1/booth/wait-time', ['current_queue_delta' => -5])
            ->assertOk()
            ->assertJsonPath('data.current_queue_count', 0);

        $this->assertSame(0, $store->fresh()->current_queue_count);
    }

    public function test_delta_is_applied_to_the_latest_value_after_order_activity(): void
    {
        $store = $this->loginAsStore(['current_queue_count' => 0]);
        $item = MenuItem::query()->create([
            'store_id' => $store->id,
            'name' => 'コーヒー',
            'description' => null,
            'price' => 300,
            'is_available' => true,
        ]);

        // レジで注文が入る（待ち人数 +1）
        $this->postJson('/api/v1/booth/accounting/orders', [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
            'settle' => true,
        ])->assertCreated();

        // 別の端末の「+1」は、古い値ではなく最新の値に足される
        $this->patchJson('/api/v1/booth/wait-time', ['current_queue_delta' => 1])
            ->assertOk()
            ->assertJsonPath('data.current_queue_count', 2);
    }

    public function test_count_and_delta_cannot_be_sent_together(): void
    {
        $store = $this->loginAsStore();

        $this->patchJson('/api/v1/booth/wait-time', [
            'current_queue_count' => 5,
            'current_queue_delta' => 1,
        ])->assertStatus(422);

        $this->assertSame(3, $store->fresh()->current_queue_count);
    }

    public function test_invalid_values_are_rejected(): void
    {
        $this->loginAsStore();

        $this->patchJson('/api/v1/booth/wait-time', ['current_queue_count' => -1])->assertStatus(422);
        $this->patchJson('/api/v1/booth/wait-time', ['current_wait_min' => 181])->assertStatus(422);
        $this->patchJson('/api/v1/booth/wait-time', ['current_queue_delta' => 'many'])->assertStatus(422);
        $this->patchJson('/api/v1/booth/wait-time', ['crowd_level' => 'full'])->assertStatus(422);
    }

    public function test_crowd_level_can_be_updated_without_changing_queue(): void
    {
        $store = $this->loginAsStore();

        $this->patchJson('/api/v1/booth/wait-time', ['crowd_level' => 'moderate'])
            ->assertOk()
            ->assertJsonPath('data.crowd_level', 'moderate')
            ->assertJsonPath('data.wait_display_text', '__crowd__:moderate')
            ->assertJsonPath('data.current_queue_count', 3);

        $this->patchJson('/api/v1/booth/wait-time', ['crowd_level' => 'crowded'])
            ->assertOk()
            ->assertJsonPath('data.crowd_level', 'crowded');

        $store->refresh();
        $this->assertSame('crowded', $store->crowd_level);
        $this->assertSame(3, $store->current_queue_count);
        $this->assertSame(4, $store->current_wait_min);

        $this->getJson("/api/v1/restaurants/{$store->id}")
            ->assertOk()
            ->assertJsonPath('data.crowd_level', 'crowded');

        $this->getJson('/api/v1/restaurants')
            ->assertOk()
            ->assertJsonPath('data.0.crowd_level', 'crowded');

        $this->getJson('/api/v1/booth/dashboard')
            ->assertOk()
            ->assertJsonPath('data.crowd_level', 'crowded')
            ->assertJsonPath('data.wait_display_text', '__crowd__:crowded');
    }

    public function test_dashboard_update_does_not_require_wait_minutes(): void
    {
        $store = $this->loginAsStore();

        $this->patchJson("/api/v1/booth/dashboard/{$store->id}", [
            'name' => '新しい店名',
            'description' => '説明',
            'is_open' => false,
        ])->assertOk();

        $store->refresh();
        $this->assertSame('新しい店名', $store->name);
        $this->assertFalse($store->is_open);
        // 送らなかった項目は変わらない
        $this->assertSame(4, $store->current_wait_min);
        $this->assertSame(3, $store->current_queue_count);
    }
}
