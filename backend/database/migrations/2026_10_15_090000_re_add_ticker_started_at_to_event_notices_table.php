<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 本番DBに ticker_started_at カラムが無いまま残っていて、
     * お知らせを「掲示板にすぐ流す」で保存すると500エラーになっていた。
     * 2026_10_14_100000 が実行済み扱いになっていても直せるよう、
     * カラムが無ければ追加し直す（既にあれば何もしない）。
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
        // カラム本体は 2026_10_14_100000 の down で消すため、ここでは何もしない
    }
};
