<?php

use App\Models\Store;
use App\Support\DbSchema;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('stores', 'show_on_call_page')) {
            Schema::table('stores', function (Blueprint $table) {
                $table->boolean('show_on_call_page')->default(false);
            });
        }

        // 列一覧のキャッシュが古いと、直後のバックフィルが列なしと判断して何もしない
        DbSchema::flush();
        // フードはこれまで受取番号ページに出ていたので、初期値は表示のままにする
        Store::backfillShowOnCallPageForFood();
    }

    public function down(): void
    {
        if (! Schema::hasColumn('stores', 'show_on_call_page')) {
            return;
        }

        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('show_on_call_page');
        });
    }
};
