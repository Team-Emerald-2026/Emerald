<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::table('map_facilities', function (Blueprint $table) {
        $table->dropForeign(['store_id']);
    });

    Schema::table('map_facilities', function (Blueprint $table) {
        $table->string('store_id')->nullable()->change();
        $table->foreign('store_id')
            ->references('id')
            ->on('stores')
            ->nullOnDelete();
    });
}

public function down(): void
{
    Schema::table('map_facilities', function (Blueprint $table) {
        $table->dropForeign(['store_id']);
    });

    Schema::table('map_facilities', function (Blueprint $table) {
        $table->string('store_id')->nullable(false)->change();
        $table->foreign('store_id')
            ->references('id')
            ->on('stores')
            ->cascadeOnDelete();
    });
}
};
