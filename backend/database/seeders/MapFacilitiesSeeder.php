<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MapFacilitiesSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $rows = [
            ['store_id' => null, 'name' => '1F 北西教室', 'type' => 'booth', 'floor' => 1, 'x' => 46, 'y' => 15],
            ['store_id' => null, 'name' => '1F 南西空間', 'type' => 'booth', 'floor' => 1, 'x' => 42, 'y' => 61],
            ['store_id' => null, 'name' => '301', 'type' => 'booth', 'floor' => 3, 'x' => 23, 'y' => 77],
            ['store_id' => null, 'name' => '302', 'type' => 'booth', 'floor' => 3, 'x' => 38, 'y' => 77],
            ['store_id' => null, 'name' => '303-1', 'type' => 'booth', 'floor' => 3, 'x' => 52, 'y' => 60],
            ['store_id' => null, 'name' => '303-2', 'type' => 'booth', 'floor' => 3, 'x' => 52, 'y' => 73],
            ['store_id' => null, 'name' => '303-3', 'type' => 'booth', 'floor' => 3, 'x' => 52, 'y' => 86],
            ['store_id' => null, 'name' => '303-4', 'type' => 'booth', 'floor' => 3, 'x' => 56, 'y' => 82],
            ['store_id' => null, 'name' => '304-5', 'type' => 'booth', 'floor' => 3, 'x' => 70, 'y' => 86],
            ['store_id' => null, 'name' => '304-6', 'type' => 'booth', 'floor' => 3, 'x' => 70, 'y' => 60],
            ['store_id' => null, 'name' => '304-7', 'type' => 'booth', 'floor' => 3, 'x' => 70, 'y' => 73],
            ['store_id' => null, 'name' => '401', 'type' => 'booth', 'floor' => 4, 'x' => 23, 'y' => 77],
            ['store_id' => null, 'name' => '402', 'type' => 'booth', 'floor' => 4, 'x' => 38, 'y' => 77],
            ['store_id' => null, 'name' => '403', 'type' => 'booth', 'floor' => 4, 'x' => 54, 'y' => 77],
            ['store_id' => null, 'name' => '404', 'type' => 'booth', 'floor' => 4, 'x' => 69, 'y' => 77],
            ['store_id' => null, 'name' => '501', 'type' => 'booth', 'floor' => 5, 'x' => 23, 'y' => 77],
            ['store_id' => null, 'name' => '502', 'type' => 'booth', 'floor' => 5, 'x' => 38, 'y' => 77],
            ['store_id' => null, 'name' => '503', 'type' => 'booth', 'floor' => 5, 'x' => 54, 'y' => 77],
            ['store_id' => null, 'name' => '504', 'type' => 'booth', 'floor' => 5, 'x' => 69, 'y' => 77],
            ['store_id' => null, 'name' => '601', 'type' => 'booth', 'floor' => 6, 'x' => 23, 'y' => 77],
            ['store_id' => null, 'name' => '602', 'type' => 'booth', 'floor' => 6, 'x' => 38, 'y' => 77],
            ['store_id' => null, 'name' => '603', 'type' => 'booth', 'floor' => 6, 'x' => 54, 'y' => 77],
            ['store_id' => null, 'name' => '604', 'type' => 'booth', 'floor' => 6, 'x' => 69, 'y' => 77],
            ['store_id' => null, 'name' => '701', 'type' => 'booth', 'floor' => 7, 'x' => 23, 'y' => 77],
            ['store_id' => null, 'name' => '702', 'type' => 'booth', 'floor' => 7, 'x' => 38, 'y' => 77],
            ['store_id' => null, 'name' => '703', 'type' => 'booth', 'floor' => 7, 'x' => 54, 'y' => 77],
            ['store_id' => null, 'name' => '704', 'type' => 'booth', 'floor' => 7, 'x' => 69, 'y' => 77],
            ['store_id' => null, 'name' => '801', 'type' => 'booth', 'floor' => 8, 'x' => 34, 'y' => 77],
            ['store_id' => null, 'name' => '802', 'type' => 'booth', 'floor' => 8, 'x' => 63, 'y' => 77],
        ];

        foreach ($rows as $row) {
            DB::table('map_facilities')->updateOrInsert(
                [
                    'floor' => $row['floor'],
                    'name' => $row['name'],
                    'store_id' => null,
                ],
                [
                    ...$row,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
        }

        $this->removeDuplicatePlaceholders();
    }

    private function removeDuplicatePlaceholders(): void
    {
        $duplicates = DB::table('map_facilities')
            ->select('floor', 'name')
            ->whereNull('store_id')
            ->groupBy('floor', 'name')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            $ids = DB::table('map_facilities')
                ->where('floor', $duplicate->floor)
                ->where('name', $duplicate->name)
                ->whereNull('store_id')
                ->orderBy('id')
                ->pluck('id');

            $ids->shift();
            if ($ids->isNotEmpty()) {
                DB::table('map_facilities')->whereIn('id', $ids)->delete();
            }
        }
    }
}
