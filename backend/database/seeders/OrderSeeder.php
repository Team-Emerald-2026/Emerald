<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class OrderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('orders')->updateOrInsert(
            ['store_id' => 'store-101', 'ticket_number' => 'A-101'],
            [
                'total_price' => 650,
                'status' => 'issued',
                'ordered_at' => now(),
                'called_at' => null,
                'served_at' => null,
                'settled_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('orders')->updateOrInsert(
            ['store_id' => 'store-102', 'ticket_number' => 'A-101'],
            [
                'total_price' => 600,
                'status' => 'settled',
                'ordered_at' => now()->subMinutes(20),
                'called_at' => now()->subMinutes(12),
                'served_at' => now()->subMinutes(10),
                'settled_at' => now()->subMinutes(5),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        $orderIdA101 = DB::table('orders')
            ->where('store_id', 'store-101')
            ->where('ticket_number', 'A-101')
            ->value('id');
        $orderIdA102 = DB::table('orders')
            ->where('store_id', 'store-102')
            ->where('ticket_number', 'A-101')
            ->value('id');

        $coffeeId = DB::table('menu_items')->where('store_id', 'store-101')->where('name', 'ブレンドコーヒー')->value('id');
        $muffinId = DB::table('menu_items')->where('store_id', 'store-101')->where('name', 'チョコマフィン')->value('id');
        $yakisobaId = DB::table('menu_items')->where('store_id', 'store-102')->where('name', '焼きそば')->value('id');
        $eggId = DB::table('menu_items')->where('store_id', 'store-102')->where('name', '目玉焼きトッピング')->value('id');

        if ($orderIdA101 && $coffeeId) {
            DB::table('order_items')->updateOrInsert(
                ['order_id' => $orderIdA101, 'menu_item_id' => $coffeeId],
                [
                    'quantity' => 1,
                    'unit_price' => 350,
                    'subtotal' => 350,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        if ($orderIdA101 && $muffinId) {
            DB::table('order_items')->updateOrInsert(
                ['order_id' => $orderIdA101, 'menu_item_id' => $muffinId],
                [
                    'quantity' => 1,
                    'unit_price' => 300,
                    'subtotal' => 300,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        if ($orderIdA102 && $yakisobaId) {
            DB::table('order_items')->updateOrInsert(
                ['order_id' => $orderIdA102, 'menu_item_id' => $yakisobaId],
                [
                    'quantity' => 1,
                    'unit_price' => 500,
                    'subtotal' => 500,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        if ($orderIdA102 && $eggId) {
            DB::table('order_items')->updateOrInsert(
                ['order_id' => $orderIdA102, 'menu_item_id' => $eggId],
                [
                    'quantity' => 1,
                    'unit_price' => 100,
                    'subtotal' => 100,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
