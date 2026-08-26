<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_entries', function (Blueprint $table) {
            $table->id();
            $table->string('store_id');
            $table->unsignedInteger('amount');
            $table->string('memo')->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->foreign('store_id')
                ->references('id')
                ->on('stores')
                ->cascadeOnDelete();
            $table->index(['store_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_entries');
    }
};
