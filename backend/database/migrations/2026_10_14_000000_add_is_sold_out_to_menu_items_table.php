<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 商品ごとの売り切れ表示。
     * is_available（削除・非表示）とは別で、売り切れ中もメニューには表示したまま注文だけ止める。
     */
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            if (! Schema::hasColumn('menu_items', 'is_sold_out')) {
                $table->boolean('is_sold_out')->default(false);
            }
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            if (Schema::hasColumn('menu_items', 'is_sold_out')) {
                $table->dropColumn('is_sold_out');
            }
        });
    }
};
