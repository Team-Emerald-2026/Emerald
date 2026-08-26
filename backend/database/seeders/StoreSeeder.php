<?php

namespace Database\Seeders;

use App\Models\Store;
use Illuminate\Database\Seeder;

class StoreSeeder extends Seeder
{
    public function run(): void
    {
        Store::upsert([
            [
                'id' => 'store-101',
                'name' => 'KTCカフェ',
                'description' => '学園祭限定メニューを提供するカフェ',
                'ticket_prefix' => 'C',
                'is_open' => true,
                'is_visible' => true,
                'current_wait_min' => 10,
                'current_queue_count' => 5,
            ],
            [
                'id' => 'store-102',
                'name' => 'やきそば',
                'description' => '人気のやきそば',
                'ticket_prefix' => 'Y',
                'is_open' => true,
                'is_visible' => true,
                'current_wait_min' => 15,
                'current_queue_count' => 8,
            ],
        ], ['id']);
    }
}