<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MapFacilitiesSeeder extends Seeder
{
    public function run(): void
    {
        // 店は未定。場所（枠）だけ定義。x/y はマップ上の％（0〜100）
        DB::table('map_facilities')->insert([
    ['store_id' => null, 'name' => '301', 'type' => 'booth', 'floor' => 3, 'x' => 22, 'y' => 69, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '302', 'type' => 'booth', 'floor' => 3, 'x' => 38, 'y' => 67, 'created_at' => now(), 'updated_at' => now()],
    // 303+304 つながる。画像どおりコの字（左2・下3・右2）
    ['store_id' => null, 'name' => '303-1', 'type' => 'booth', 'floor' => 3, 'x' => 52, 'y' => 56, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '303-2', 'type' => 'booth', 'floor' => 3, 'x' => 52, 'y' => 68, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '303-3', 'type' => 'booth', 'floor' => 3, 'x' => 53, 'y' => 80, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '303-4', 'type' => 'booth', 'floor' => 3, 'x' => 60, 'y' => 80, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '304-5', 'type' => 'booth', 'floor' => 3, 'x' => 70, 'y' => 80, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '304-6', 'type' => 'booth', 'floor' => 3, 'x' => 72, 'y' => 56, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '304-7', 'type' => 'booth', 'floor' => 3, 'x' => 72, 'y' => 68, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '401', 'type' => 'booth', 'floor' => 4, 'x' => 22, 'y' => 69, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '402', 'type' => 'booth', 'floor' => 4, 'x' => 38, 'y' => 67, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '403', 'type' => 'booth', 'floor' => 4, 'x' => 53, 'y' => 66, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '404', 'type' => 'booth', 'floor' => 4, 'x' => 69, 'y' => 67, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '501', 'type' => 'booth', 'floor' => 5, 'x' => 21, 'y' => 69, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '502', 'type' => 'booth', 'floor' => 5, 'x' => 38, 'y' => 66, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '503', 'type' => 'booth', 'floor' => 5, 'x' => 53, 'y' => 66, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '504', 'type' => 'booth', 'floor' => 5, 'x' => 69, 'y' => 65, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '601', 'type' => 'booth', 'floor' => 6, 'x' => 23, 'y' => 70, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '602', 'type' => 'booth', 'floor' => 6, 'x' => 38, 'y' => 66, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '603', 'type' => 'booth', 'floor' => 6, 'x' => 54, 'y' => 67, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '604', 'type' => 'booth', 'floor' => 6, 'x' => 70, 'y' => 66, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '701', 'type' => 'booth', 'floor' => 7, 'x' => 22, 'y' => 70, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '702', 'type' => 'booth', 'floor' => 7, 'x' => 38, 'y' => 66, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '703', 'type' => 'booth', 'floor' => 7, 'x' => 54, 'y' => 66, 'created_at' => now(), 'updated_at' => now()],
    ['store_id' => null, 'name' => '704', 'type' => 'booth', 'floor' => 7, 'x' => 69, 'y' => 66, 'created_at' => now(), 'updated_at' => now()],
]);
    }
}