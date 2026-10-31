<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * 整理券を「1〜上限枚数」で使い回す方式にするための設定を追加する。
     * - ticket_limit: 整理券の枚数（既定20）
     * - disabled_ticket_numbers: 非表示（紛失など）にした番号の一覧。発番時に飛ばす
     * 番号を使い回すため、(store_id, ticket_number) の一意制約も外す。
     */
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->unsignedInteger('ticket_limit')->default(20);
            $table->json('disabled_ticket_numbers')->nullable();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('orders_store_id_ticket_number_unique');
            // 一意制約の代わりに、検索用の通常インデックスを残す
            $table->index(['store_id', 'ticket_number'], 'orders_store_id_ticket_number_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_store_id_ticket_number_index');
            $table->unique(['store_id', 'ticket_number'], 'orders_store_id_ticket_number_unique');
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn(['ticket_limit', 'disabled_ticket_numbers']);
        });
    }
};
