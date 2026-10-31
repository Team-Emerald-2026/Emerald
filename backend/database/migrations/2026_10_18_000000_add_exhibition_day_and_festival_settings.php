<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('stores', 'exhibition_day')) {
            Schema::table('stores', function (Blueprint $table) {
                // day1 / day2 / both（両日出展）
                $table->string('exhibition_day', 16)->default('both')->after('is_visible');
            });
        }

        if (! Schema::hasTable('festival_settings')) {
            Schema::create('festival_settings', function (Blueprint $table) {
                $table->string('key', 64)->primary();
                $table->string('value', 255);
                $table->timestamps();
            });
        }

        $exists = DB::table('festival_settings')->where('key', 'current_day')->exists();
        if (! $exists) {
            DB::table('festival_settings')->insert([
                'key' => 'current_day',
                'value' => 'day1',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('stores', 'exhibition_day')) {
            Schema::table('stores', function (Blueprint $table) {
                $table->dropColumn('exhibition_day');
            });
        }

        Schema::dropIfExists('festival_settings');
    }
};
