<?php

namespace Tests\Feature;

use App\Models\MapFacilities;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminMapFacilityTest extends TestCase
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

    private function createStore(string $id = 'store-101'): Store
    {
        return Store::query()->create([
            'id' => $id,
            'name' => 'KTCカフェ',
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

    private function createPlace(array $overrides = []): MapFacilities
    {
        return MapFacilities::query()->create(array_merge([
            'store_id' => null,
            'name' => '301',
            'type' => 'booth',
            'floor' => 3,
            'x' => 50,
            'y' => 40,
        ], $overrides));
    }

    public function test_admin_can_list_places_with_store_info(): void
    {
        $store = $this->createStore();
        $this->createPlace(['name' => '301']);
        $this->createPlace(['store_id' => $store->id, 'name' => $store->name, 'x' => 10, 'y' => 10]);

        Sanctum::actingAs($this->createAdmin());

        $response = $this->getJson('/api/v1/admin/map/facilities')->assertOk();

        $data = collect($response->json('data'));
        $this->assertCount(2, $data);
        $this->assertSame('KTCカフェ', $data->firstWhere('store_id', 'store-101')['store_name']);
        $this->assertNull($data->firstWhere('name', '301')['store_id']);
    }

    public function test_admin_can_create_place(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $this->postJson('/api/v1/admin/map/facilities', [
            'name' => '新しい教室',
            'type' => 'booth',
            'floor' => 4,
            'x' => 25,
            'y' => 60,
        ])->assertCreated();

        $this->assertDatabaseHas('map_facilities', [
            'name' => '新しい教室',
            'floor' => 4,
            'x' => 25,
            'y' => 60,
            'store_id' => null,
        ]);
    }

    public function test_create_rejects_out_of_range_position(): void
    {
        Sanctum::actingAs($this->createAdmin());

        $this->postJson('/api/v1/admin/map/facilities', [
            'name' => '範囲外',
            'type' => 'booth',
            'floor' => 3,
            'x' => 120,
            'y' => 10,
        ])->assertStatus(422);

        $this->assertDatabaseMissing('map_facilities', ['name' => '範囲外']);
    }

    public function test_admin_can_move_place(): void
    {
        $place = $this->createPlace();
        Sanctum::actingAs($this->createAdmin());

        $this->patchJson("/api/v1/admin/map/facilities/{$place->id}", ['x' => 70, 'y' => 20])
            ->assertOk();

        $this->assertDatabaseHas('map_facilities', ['id' => $place->id, 'x' => 70, 'y' => 20, 'name' => '301']);
    }

    public function test_store_linked_pin_cannot_be_renamed_but_can_be_moved(): void
    {
        $store = $this->createStore();
        $pin = $this->createPlace(['store_id' => $store->id, 'name' => $store->name, 'type' => 'food']);
        Sanctum::actingAs($this->createAdmin());

        $this->patchJson("/api/v1/admin/map/facilities/{$pin->id}", [
            'name' => '勝手に変更',
            'type' => 'shop',
            'x' => 11,
        ])->assertOk();

        $this->assertDatabaseHas('map_facilities', [
            'id' => $pin->id,
            'name' => 'KTCカフェ',
            'type' => 'food',
            'x' => 11,
        ]);
    }

    public function test_admin_can_delete_unlinked_place(): void
    {
        $place = $this->createPlace();
        Sanctum::actingAs($this->createAdmin());

        $this->deleteJson("/api/v1/admin/map/facilities/{$place->id}")->assertNoContent();

        $this->assertDatabaseMissing('map_facilities', ['id' => $place->id]);
    }

    public function test_store_linked_pin_cannot_be_deleted(): void
    {
        $store = $this->createStore();
        $pin = $this->createPlace(['store_id' => $store->id, 'name' => $store->name]);
        Sanctum::actingAs($this->createAdmin());

        $response = $this->deleteJson("/api/v1/admin/map/facilities/{$pin->id}")->assertStatus(409);

        $this->assertStringContainsString('KTCカフェ', $response->json('error.message'));
        $this->assertDatabaseHas('map_facilities', ['id' => $pin->id]);
    }

    public function test_map_editing_requires_admin_role(): void
    {
        config(['admin.public_access' => false]);
        $place = $this->createPlace();
        $store = $this->createStore();
        $storeUser = User::query()->create([
            'login_id' => 'cafe_admin',
            'password' => Hash::make('password123'),
            'store_id' => $store->id,
            'role' => 'store',
        ]);
        Sanctum::actingAs($storeUser);

        $this->getJson('/api/v1/admin/map/facilities')->assertForbidden();
        $this->postJson('/api/v1/admin/map/facilities', [
            'name' => 'x', 'type' => 'booth', 'floor' => 3, 'x' => 1, 'y' => 1,
        ])->assertForbidden();
        $this->patchJson("/api/v1/admin/map/facilities/{$place->id}", ['x' => 5])->assertForbidden();
        $this->deleteJson("/api/v1/admin/map/facilities/{$place->id}")->assertForbidden();

        $this->assertDatabaseHas('map_facilities', ['id' => $place->id]);
    }
}
