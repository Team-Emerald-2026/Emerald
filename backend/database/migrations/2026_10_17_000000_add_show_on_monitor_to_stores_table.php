<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('stores', 'show_on_monitor')) {
            return;
        }

        Schema::table('stores', function (Blueprint $table) {
            $table->boolean('show_on_monitor')->default(false);
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('stores', 'show_on_monitor')) {
            return;
        }

        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('show_on_monitor');
        });
    }
};
