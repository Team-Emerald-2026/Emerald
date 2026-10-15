<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $loginId = config('admin.login_id');
        $password = config('admin.password');

        if (! is_string($loginId) || $loginId === '' || ! is_string($password) || $password === '') {
            return;
        }

        User::query()->firstOrCreate(
            ['login_id' => $loginId],
            [
                'password' => Hash::make($password),
                'store_id' => null,
                'role' => 'admin',
            ],
        );
    }
}
