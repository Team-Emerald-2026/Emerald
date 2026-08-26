<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            if (! Schema::hasColumn('stores', 'wait_display_mode')) {
                $table->string('wait_display_mode', 16)->default('minutes')->after('current_queue_count');
            }
            if (! Schema::hasColumn('stores', 'wait_display_text')) {
                $table->string('wait_display_text')->nullable()->after('wait_display_mode');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            if (Schema::hasColumn('stores', 'wait_display_text')) {
                $table->dropColumn('wait_display_text');
            }
            if (Schema::hasColumn('stores', 'wait_display_mode')) {
                $table->dropColumn('wait_display_mode');
            }
        });
    }
};
