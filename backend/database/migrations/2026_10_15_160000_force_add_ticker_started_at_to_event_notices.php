<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 本番で ticker_started_at が無いまま、以前のマイグレーションが
     * 実行済み扱いになっていた。hasColumn に頼らず追加を試みる。
     */
    public function up(): void
    {
        try {
            Schema::table('event_notices', function (Blueprint $table) {
                $table->timestamp('ticker_started_at')->nullable();
            });
        } catch (\Throwable) {
            // 既にあれば何もしない
        }
    }

    public function down(): void
    {
        // 残す。本番の掲示板機能で使うカラムのため
    }
};
