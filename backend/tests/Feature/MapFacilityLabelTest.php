<?php

namespace Tests\Feature;

use App\Models\MapFacilities;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * 地図のピンに表示する「場所の名前（部屋番号など）」= label のテスト。
 * 店舗が入った枠でも、同じ階・同じ位置にある空き枠の名前が label として返る。
 */
class MapFacilityLabelTest extends TestCase
{
    use RefreshDatabase;

    private function createStore(string $id = 'store-101', string $name = 'KTCカフェ'): Store
    {
        return Store::query()->create([
            'id' => $id,
            'name' => $name,
            'description' => '',
            'ticket_prefix' => 'C',
            'is_open' => true,
            'is_visible' => true,
            'current_wait_min' => 0,
            'current_queue_count' => 0,
            'wait_display_mode' => 'minutes',
            'wait_display_text' => null,
        ]);
    }

    private function createFacility(array $overrides = []): MapFacilities
    {
        return MapFacilities::query()->create(array_merge([
            'store_id' => null,
            'name' => '301',
            'type' => 'booth',
            'floor' => 3,
            'x' => 22,
            'y' => 77,
        ], $overrides));
    }

    private function admin(): User
    {
        return User::query()->create([
            'login_id' => 'admin',
            'password' => Hash::make('password123'),
            'store_id' => null,
            'role' => 'admin',
        ]);
    }

    public function test_public_map_uses_slot_name_as_label_for_store_pin(): void
    {
        $store = $this->createStore();
        // 空き枠「301」と、同じ位置に店舗のピン（店名）がある状態
        $this->createFacility(['name' => '301']);
        $this->createFacility(['store_id' => $store->id, 'name' => $store->name]);

        $response = $this->getJson('/api/v1/map/facilities')->assertOk();

        $data = collect($response->json('data'));
        // 同じ位置は店舗のピンだけが返る（空き枠は隠れる）
        $this->assertCount(1, $data);
        $this->assertSame('KTCカフェ', $data[0]['name']);
        $this->assertSame('301', $data[0]['label']);
        $this->assertSame('301', $data[0]['attributes']['label']);
    }

    public function test_public_map_label_is_own_name_for_placeholder(): void
    {
        $this->createFacility(['name' => '302', 'x' => 38, 'y' => 72]);

        $data = collect($this->getJson('/api/v1/map/facilities')->assertOk()->json('data'));

        $this->assertSame('302', $data[0]['label']);
    }

    public function test_public_map_label_is_null_for_store_pin_without_slot(): void
    {
        $store = $this->createStore();
        $this->createFacility(['store_id' => $store->id, 'name' => $store->name, 'x' => 10, 'y' => 10]);
        // 位置が違う空き枠は、ラベルとして使わない
        $this->createFacility(['name' => '301', 'x' => 22, 'y' => 77]);

        $data = collect($this->getJson('/api/v1/map/facilities')->assertOk()->json('data'));

        $storePin = $data->firstWhere('store_id', $store->id);
        $this->assertNull($storePin['label']);
        $this->assertSame('KTCカフェ', $storePin['name']);
    }

    public function test_slot_on_another_floor_is_not_used_as_label(): void
    {
        $store = $this->createStore();
        $this->createFacility(['name' => '401', 'floor' => 4]);
        $this->createFacility(['store_id' => $store->id, 'name' => $store->name, 'floor' => 3]);

        $data = collect($this->getJson('/api/v1/map/facilities')->assertOk()->json('data'));

        $this->assertNull($data->firstWhere('store_id', $store->id)['label']);
    }

    public function test_admin_map_returns_label_for_each_pin(): void
    {
        $store = $this->createStore();
        $this->createFacility(['name' => '301']);
        $this->createFacility(['store_id' => $store->id, 'name' => $store->name]);
        $this->createFacility(['store_id' => null, 'name' => '302', 'x' => 38, 'y' => 72]);
        Sanctum::actingAs($this->admin());

        $data = collect($this->getJson('/api/v1/admin/map/facilities')->assertOk()->json('data'));

        $this->assertSame('301', $data->firstWhere('store_id', $store->id)['label']);
        $this->assertSame('302', $data->firstWhere('name', '302')['label']);
        // 空き枠の「301」自身も 301
        $this->assertSame('301', $data->first(fn ($row) => $row['name'] === '301')['label']);
    }

    public function test_admin_update_response_includes_label(): void
    {
        $store = $this->createStore();
        $this->createFacility(['name' => '301']);
        $pin = $this->createFacility(['store_id' => $store->id, 'name' => $store->name, 'x' => 50, 'y' => 50]);
        Sanctum::actingAs($this->admin());

        // 店舗のピンを空き枠「301」の位置に動かすと、ラベルは 301 になる
        $this->patchJson("/api/v1/admin/map/facilities/{$pin->id}", ['x' => 22, 'y' => 77])
            ->assertOk()
            ->assertJsonPath('data.label', '301');
    }
}
