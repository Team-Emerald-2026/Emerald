<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * お知らせを電光掲示板に「すぐ流す」ための設定。
     * - ticker_started_at: 流し始めた時刻。null のときは流さない
     *   （流す時間は ticker_after_minutes。null のときは止めるまで流す）
     */
    public function up(): void
    {
        Schema::table('event_notices', function (Blueprint $table) {
            if (! Schema::hasColumn('event_notices', 'ticker_started_at')) {
                $table->timestamp('ticker_started_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('event_notices', function (Blueprint $table) {
            if (Schema::hasColumn('event_notices', 'ticker_started_at')) {
                $table->dropColumn('ticker_started_at');
            }
        });
    }
};
