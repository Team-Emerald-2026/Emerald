<?php

namespace Tests\Feature;

use App\Models\FestivalSetting;
use App\Models\MapFacilities;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExhibitionDayTest extends TestCase
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

    private function createStore(string $id, string $exhibitionDay, array $overrides = []): Store
    {
        return Store::query()->create(array_merge([
            'id' => $id,
            'name' => $id,
            'description' => '',
            'ticket_prefix' => null,
            'is_open' => true,
            'is_visible' => true,
            'exhibition_day' => $exhibitionDay,
            'current_wait_min' => 0,
            'current_queue_count' => 0,
            'wait_display_mode' => 'minutes',
            'wait_display_text' => null,
        ], $overrides));
    }

    public function test_visitor_restaurants_filter_by_current_festival_day(): void
    {
        FestivalSetting::setCurrentDay('day1');

        $this->createStore('store-day1', 'day1');
        $this->createStore('store-day2', 'day2');
        $this->createStore('store-both', 'both');

        $this->getJson('/api/v1/restaurants')
            ->assertOk()
            ->assertJsonPath('meta.current_day', 'day1')
            ->assertJsonCount(2, 'data');

        $ids = collect($this->getJson('/api/v1/restaurants')->json('data'))->pluck('id')->all();
        $this->assertContains('store-day1', $ids);
        $this->assertContains('store-both', $ids);
        $this->assertNotContains('store-day2', $ids);
    }

    public function test_admin_can_switch_festival_day_default_without_hiding_stores(): void
    {
        $day1 = $this->createStore('store-day1', 'day1');
        $day2 = $this->createStore('store-day2', 'day2');
        $both = $this->createStore('store-both', 'both');

        Sanctum::actingAs($this->createAdmin());

        $this->patchJson('/api/v1/admin/festival-day', ['day' => 'day2'])
            ->assertOk()
            ->assertJsonPath('data.current_day', 'day2');

        // 日付切り替えでは is_visible を触らない（来場者が両日を見られるようにする）
        $this->assertTrue($day1->fresh()->is_visible);
        $this->assertTrue($day2->fresh()->is_visible);
        $this->assertTrue($both->fresh()->is_visible);

        $this->getJson('/api/v1/restaurants')
            ->assertOk()
            ->assertJsonPath('meta.current_day', 'day2')
            ->assertJsonPath('meta.filter_day', 'day2');

        $ids = collect($this->getJson('/api/v1/restaurants')->json('data'))->pluck('id')->all();
        $this->assertContains('store-day2', $ids);
        $this->assertContains('store-both', $ids);
        $this->assertNotContains('store-day1', $ids);
    }

    public function test_visitor_can_filter_restaurants_by_day_query(): void
    {
        FestivalSetting::setCurrentDay('day1');

        $this->createStore('store-day1', 'day1');
        $this->createStore('store-day2', 'day2');
        $this->createStore('store-both', 'both');

        $this->getJson('/api/v1/restaurants?day=day2')
            ->assertOk()
            ->assertJsonPath('meta.current_day', 'day1')
            ->assertJsonPath('meta.filter_day', 'day2');

        $ids = collect($this->getJson('/api/v1/restaurants?day=day2')->json('data'))->pluck('id')->all();
        $this->assertContains('store-day2', $ids);
        $this->assertContains('store-both', $ids);
        $this->assertNotContains('store-day1', $ids);
    }

    public function test_map_shows_only_current_day_store_at_shared_location(): void
    {
        FestivalSetting::setCurrentDay('day1');

        $day1 = $this->createStore('store-604-a', 'day1', ['name' => '1日目の店']);
        $day2 = $this->createStore('store-604-b', 'day2', ['name' => '2日目の店']);

        MapFacilities::query()->create([
            'store_id' => null,
            'name' => '604',
            'type' => 'booth',
            'floor' => 6,
            'x' => 40,
            'y' => 50,
        ]);
        MapFacilities::query()->create([
            'store_id' => $day1->id,
            'name' => $day1->name,
            'type' => 'booth',
            'floor' => 6,
            'x' => 40,
            'y' => 50,
        ]);
        MapFacilities::query()->create([
            'store_id' => $day2->id,
            'name' => $day2->name,
            'type' => 'booth',
            'floor' => 6,
            'x' => 40,
            'y' => 50,
        ]);

        $response = $this->getJson('/api/v1/map/facilities')->assertOk();
        $at604 = collect($response->json('data'))->first(
            fn ($item) => (int) $item['floor'] === 6 && (int) $item['x'] === 40 && (int) $item['y'] === 50,
        );

        $this->assertNotNull($at604);
        $this->assertSame('store-604-a', $at604['store_id']);
        $this->assertSame('604', $at604['label'] ?? null);
    }

    public function test_map_hides_empty_slot_when_only_other_day_store_is_assigned(): void
    {
        FestivalSetting::setCurrentDay('day1');

        $day2 = $this->createStore('store-corridor', 'day2', ['name' => 'サークルの販売スペース']);

        MapFacilities::query()->create([
            'store_id' => null,
            'name' => '6',
            'type' => 'shop',
            'floor' => 6,
            'x' => 49,
            'y' => 39,
        ]);
        MapFacilities::query()->create([
            'store_id' => $day2->id,
            'name' => $day2->name,
            'type' => 'shop',
            'floor' => 6,
            'x' => 49,
            'y' => 39,
        ]);
        // 店舗の無い枠は両日とも残る
        MapFacilities::query()->create([
            'store_id' => null,
            'name' => '非常口',
            'type' => 'emergency_exit',
            'floor' => 6,
            'x' => 74,
            'y' => 32,
        ]);

        $day1Items = collect($this->getJson('/api/v1/map/facilities?day=day1')->assertOk()->json('data'));
        $this->assertNull(
            $day1Items->first(
                fn ($item) => (int) $item['floor'] === 6 && (int) $item['x'] === 49 && (int) $item['y'] === 39,
            ),
            '1日目には2日目専用ブースの部屋枠だけが残ってはいけない',
        );
        $this->assertNotNull(
            $day1Items->first(fn ($item) => ($item['name'] ?? null) === '非常口'),
            '店舗の無い枠は1日目も表示する',
        );

        $day2Items = collect($this->getJson('/api/v1/map/facilities?day=day2')->assertOk()->json('data'));
        $atCorridor = $day2Items->first(
            fn ($item) => (int) $item['floor'] === 6 && (int) $item['x'] === 49 && (int) $item['y'] === 39,
        );
        $this->assertNotNull($atCorridor);
        $this->assertSame('store-corridor', $atCorridor['store_id']);
        $this->assertSame('6', $atCorridor['label'] ?? null);
    }

    public function test_admin_can_create_store_with_exhibition_day(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $this->postJson('/api/v1/admin/stores', [
            'id' => 'store-new',
            'name' => '日替わりブース',
            'description' => '2日目のみ',
            'type' => 'booth',
            'floor' => 6,
            'map_x' => 40,
            'map_y' => 50,
            'login_id' => 'booth2',
            'password' => 'password123',
            'exhibition_day' => 'day2',
        ])->assertCreated()
            ->assertJsonPath('data.exhibition_day', 'day2');

        $this->assertSame('day2', Store::query()->find('store-new')?->exhibition_day);
    }

    public function test_admin_can_create_store_without_description(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $this->postJson('/api/v1/admin/stores', [
            'id' => 'store-no-desc',
            'name' => '説明なし店舗',
            'type' => 'booth',
            'floor' => 1,
            'map_x' => 10,
            'map_y' => 20,
            'login_id' => 'nodesc',
            'password' => 'abcd1234',
        ])->assertCreated();

        $this->assertSame('', Store::query()->find('store-no-desc')?->description ?? null);
    }

    public function test_admin_store_password_must_be_alphanumeric_min_8(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $this->postJson('/api/v1/admin/stores', [
            'id' => 'store-bad-pass',
            'name' => '弱いパス',
            'type' => 'booth',
            'floor' => 1,
            'map_x' => 10,
            'map_y' => 20,
            'login_id' => 'badpass',
            'password' => 'short',
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_PARAMS');

        $this->postJson('/api/v1/admin/stores', [
            'id' => 'store-bad-pass-2',
            'name' => '記号パス',
            'type' => 'booth',
            'floor' => 1,
            'map_x' => 10,
            'map_y' => 20,
            'login_id' => 'badpass2',
            'password' => 'pass-word',
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_PARAMS');
    }

    public function test_admin_store_update_keeps_password_when_left_blank(): void
    {
        Sanctum::actingAs($this->createAdmin());
        $this->createStore('store-keep-pass', 'both');
        $storeUser = User::query()->create([
            'login_id' => 'keeppass',
            'password' => Hash::make('original123'),
            'store_id' => 'store-keep-pass',
            'role' => 'store',
        ]);

        $payload = [
            'name' => '名前を変えた',
            'description' => '',
            'type' => 'booth',
            'floor' => 1,
            'map_x' => 10,
            'map_y' => 20,
            'login_id' => 'keeppass',
            'password' => '',
            'exhibition_day' => 'both',
            'is_open' => true,
            'is_visible' => true,
            'show_on_monitor' => false,
            'current_wait_min' => 0,
            'current_queue_count' => 0,
        ];

        $this->patchJson('/api/v1/admin/stores/store-keep-pass', $payload)->assertOk();
        $this->assertTrue(Hash::check('original123', $storeUser->fresh()->password));

        $this->patchJson('/api/v1/admin/stores/store-keep-pass', [...$payload, 'password' => 'changed456'])
            ->assertOk();
        $this->assertTrue(Hash::check('changed456', $storeUser->fresh()->password));
    }
}
