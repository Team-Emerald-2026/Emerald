<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MenuItemSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $menuItems = [
            [
                'store_id' => 'store-101',
                'name' => 'ブレンドコーヒー',
                'description' => '定番のホットコーヒー',
                'price' => 350,
                'is_available' => true,
            ],
            [
                'store_id' => 'store-101',
                'name' => 'チョコマフィン',
                'description' => 'しっとり食感のマフィン',
                'price' => 300,
                'is_available' => true,
            ],
            [
                'store_id' => 'store-102',
                'name' => '焼きそば',
                'description' => '学園祭定番ソース焼きそば',
                'price' => 500,
                'is_available' => true,
            ],
            [
                'store_id' => 'store-102',
                'name' => '目玉焼きトッピング',
                'description' => '焼きそば用トッピング',
                'price' => 100,
                'is_available' => true,
            ],
        ];

        foreach ($menuItems as $menuItem) {
            DB::table('menu_items')->updateOrInsert(
                [
                    'store_id' => $menuItem['store_id'],
                    'name' => $menuItem['name'],
                ],
                [
                    'description' => $menuItem['description'],
                    'price' => $menuItem['price'],
                    'is_available' => $menuItem['is_available'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
