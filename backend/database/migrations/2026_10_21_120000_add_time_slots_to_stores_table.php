<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('stores', 'time_slots')) {
            return;
        }

        Schema::table('stores', function (Blueprint $table) {
            // [{"day": "day1"|"day2"|null, "start": "11:00", "end": "13:00"}]。空なら一日中
            $table->json('time_slots')->nullable();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('stores', 'time_slots')) {
            return;
        }

        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('time_slots');
        });
    }
};
