<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['store_id']);
            $table->string('store_id')->nullable()->change();
            $table->string('role')->default('store')->after('store_id');
            $table->foreign('store_id')
                ->references('id')
                ->on('stores')
                ->nullOnDelete();
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->boolean('is_visible')->default(true)->after('is_open');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['store_id']);
            $table->dropColumn('role');
            $table->string('store_id')->nullable(false)->change();
            $table->foreign('store_id')
                ->references('id')
                ->on('stores')
                ->cascadeOnDelete();
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('is_visible');
        });
    }
};
