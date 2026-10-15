<?php

namespace Database\Seeders;

use App\Models\MapFacilities;
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

        // 本番起動ではテスト用データを入れない。必要なときだけローカルで `php artisan db:seed` する。
        if (app()->environment('production')) {
            return;
        }

        $this->call(StoreSeeder::class);
        // 管理画面の「マップ編集」で場所を動かしたり消したりした内容を上書きしないよう、
        // 場所（店舗なしのピン）が1件でもあれば入れ直さない。
        // 初期状態に戻したいときは `php artisan db:seed --class=MapFacilitiesSeeder` を直接実行する。
        if (! MapFacilities::query()->whereNull('store_id')->exists()) {
            $this->call(MapFacilitiesSeeder::class);
        }
        $this->call(MenuItemSeeder::class);
        $this->call(OrderSeeder::class);
        $this->call(UserSeeder::class);
        $this->call(EventNoticeSeeder::class);
    }
}
