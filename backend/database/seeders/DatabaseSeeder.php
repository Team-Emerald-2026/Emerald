<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();
        $this->call(StoreSeeder::class);
        $this->call(MapFacilitiesSeeder::class);
        $this->call(MenuItemSeeder::class);
        $this->call(OrderSeeder::class);
        $this->call(UserSeeder::class);
        $this->call(EventNoticeSeeder::class);
    }
}
