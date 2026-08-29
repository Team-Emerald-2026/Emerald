<?php

namespace Database\Seeders;

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
        $this->call(AdminUserSeeder::class);
        $this->call(StoreSeeder::class);
        $this->call(MapFacilitiesSeeder::class);
        $this->call(MenuItemSeeder::class);
        $this->call(OrderSeeder::class);
        $this->call(UserSeeder::class);
        $this->call(EventNoticeSeeder::class);
    }
}
