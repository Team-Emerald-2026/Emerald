<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * イベントの開催場所（校内マップの部屋）。
     * null のときは場所の表示なし。部屋が削除されたら場所も空にする。
     */
    public function up(): void
    {
        if (Schema::hasColumn('event_notices', 'map_facility_id')) {
            return;
        }

        Schema::table('event_notices', function (Blueprint $table) {
            $table->foreignId('map_facility_id')
                ->nullable()
                ->constrained('map_facilities')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('event_notices', 'map_facility_id')) {
            return;
        }

        Schema::table('event_notices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('map_facility_id');
        });
    }
};
