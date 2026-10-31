<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('stores', 'crowd_level')) {
            return;
        }

        Schema::table('stores', function (Blueprint $table) {
            $table->string('crowd_level', 16)->nullable();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('stores', 'crowd_level')) {
            return;
        }

        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('crowd_level');
        });
    }
};
