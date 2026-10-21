<?php

namespace Tests\Feature;

use App\Models\FestivalSetting;
use App\Models\MapFacilities;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BoothTimeSlotTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
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

    private function createStoreInRoom801(string $id, string $name, ?array $timeSlots): Store
    {
        $store = Store::query()->create([
            'id' => $id,
            'name' => $name,
            'description' => '',
            'ticket_prefix' => null,
            'is_open' => true,
            'is_visible' => true,
            'exhibition_day' => 'both',
            'current_wait_min' => 0,
            'current_queue_count' => 0,
            'wait_display_mode' => 'minutes',
            'wait_display_text' => null,
            'time_slots' => $timeSlots,
        ]);

        MapFacilities::query()->create([
            'store_id' => $store->id,
            'name' => $name,
            'type' => 'booth',
            'floor' => 8,
            'x' => 30,
            'y' => 40,
        ]);

        return $store;
    }

    /** @return \Illuminate\Support\Collection<int, array<string, mixed>> */
    private function room801(string $query = '')
    {
        $response = $this->getJson('/api/v1/map/facilities'.$query)->assertOk();

        return collect($response->json('data'))
            ->filter(fn ($item) => (int) $item['floor'] === 8 && (int) $item['x'] === 30 && (int) $item['y'] === 40)
            ->values();
    }

    private function seedRoom801(): void
    {
        FestivalSetting::setCurrentDay('day1');
        MapFacilities::query()->create([
            'store_id' => null,
            'name' => '801',
            'type' => 'booth',
            'floor' => 8,
            'x' => 30,
            'y' => 40,
        ]);
        $this->createStoreInRoom801('store801-quiz', 'クイズ王', [
            ['day' => null, 'start' => '11:00', 'end' => '13:00'],
        ]);
        $this->createStoreInRoom801('store801-live', 'AFTER LIVE', [
            ['day' => null, 'start' => '15:00', 'end' => '16:30'],
        ]);
    }

    public function test_map_returns_every_time_slot_booth_in_the_room(): void
    {
        $this->seedRoom801();

        // 地図APIは同じ教室のブースを全部返す。ピンを1つにするのは画面側。
        $at801 = $this->room801();
        $this->assertCount(2, $at801);
        $this->assertEqualsCanonicalizing(
            ['store801-quiz', 'store801-live'],
            $at801->pluck('store_id')->all(),
        );
        $this->assertTrue($at801->every(fn ($item) => ($item['label'] ?? null) === '801'));

        $quiz = $at801->firstWhere('store_id', 'store801-quiz');
        $this->assertSame('11:00', $quiz['time_slots'][0]['start']);
        $this->assertSame('13:00', $quiz['time_slots'][0]['end']);
        $live = $at801->firstWhere('store_id', 'store801-live');
        $this->assertSame('15:00', $live['time_slots'][0]['start']);
        $this->assertSame('16:30', $live['time_slots'][0]['end']);
    }

    public function test_store_with_slots_only_on_other_day_is_hidden_that_day(): void
    {
        FestivalSetting::setCurrentDay('day1');
        $this->createStoreInRoom801('store801-day2', '2日目だけ', [
            ['day' => 'day2', 'start' => '10:00', 'end' => '12:00'],
        ]);

        $ids = collect($this->getJson('/api/v1/restaurants')->json('data'))->pluck('id')->all();
        $this->assertNotContains('store801-day2', $ids);

        $day2 = collect($this->getJson('/api/v1/restaurants?day=day2')->json('data'))
            ->firstWhere('id', 'store801-day2');
        $this->assertNotNull($day2);
        $this->assertSame(8, $day2['floor']);
        $this->assertSame('10:00', $day2['time_slots'][0]['start']);

        $this->assertNull(collect($this->getJson('/api/v1/map/facilities')->json('data'))
            ->firstWhere('store_id', 'store801-day2'));
        $this->assertNotNull(collect($this->getJson('/api/v1/map/facilities?day=day2')->json('data'))
            ->firstWhere('store_id', 'store801-day2'));
    }

    public function test_admin_can_set_and_keep_time_slots(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $payload = [
            'id' => 'store603-prog',
            'name' => 'プログラミング教室',
            'description' => '',
            'type' => 'booth',
            'floor' => 6,
            'map_x' => 40,
            'map_y' => 50,
            'login_id' => 'store603prog',
            'password' => 'password123',
            'exhibition_day' => 'both',
            'is_open' => true,
            'show_on_monitor' => false,
            'current_wait_min' => 0,
            'current_queue_count' => 0,
            'time_slots' => [
                ['day' => null, 'start' => '14:00', 'end' => '16:00'],
                ['day' => null, 'start' => '11:00', 'end' => '12:00'],
            ],
        ];

        $this->postJson('/api/v1/admin/stores', $payload)
            ->assertCreated()
            ->assertJsonPath('data.time_slots.0.start', '11:00')
            ->assertJsonPath('data.time_slots.1.start', '14:00');

        // time_slots を送らない更新（モニター切り替えなど）では消えない
        $update = $payload;
        unset($update['id'], $update['password'], $update['time_slots']);
        $update['show_on_monitor'] = true;
        $update['is_visible'] = true;
        $this->patchJson('/api/v1/admin/stores/store603-prog', $update)->assertOk();
        $this->assertCount(2, Store::query()->find('store603-prog')->time_slots);

        // 空で送ると一日中に戻る
        $this->patchJson('/api/v1/admin/stores/store603-prog', [...$update, 'time_slots' => []])
            ->assertOk()
            ->assertJsonPath('data.time_slots', []);
        $this->assertNull(Store::query()->find('store603-prog')->time_slots);

        // 終了が開始より前はエラー
        $this->patchJson('/api/v1/admin/stores/store603-prog', [
            ...$update,
            'time_slots' => [['day' => null, 'start' => '13:00', 'end' => '12:00']],
        ])->assertUnprocessable()->assertJsonValidationErrors('time_slots.0.end', 'error.details');
    }
}
