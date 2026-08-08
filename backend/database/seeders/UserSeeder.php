<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('users')->updateOrInsert(
            [
                'login_id' => 'testuser',
                'store_id' => 'store-101',
                'password' => bcrypt('password'),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'login_id' => 'testuser2',
                'store_id' => 'store-102',
                'password' => bcrypt('password'),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
}
