<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach (
            [
                [
                    'login_id' => 'testuser',
                    'store_id' => 'store-101',
                    'role' => 'store',
                    'password' => Hash::make('password'),
                ],
                [
                    'login_id' => 'testuser2',
                    'store_id' => 'store-102',
                    'role' => 'store',
                    'password' => Hash::make('password'),
                ],
                [
                    'login_id' => 'admin',
                    'store_id' => null,
                    'role' => 'admin',
                    'password' => Hash::make('password'),
                ],
            ] as $user
        ) {
            DB::table('users')->updateOrInsert(
                ['login_id' => $user['login_id']],
                [
                    ...$user,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }
    }
}
