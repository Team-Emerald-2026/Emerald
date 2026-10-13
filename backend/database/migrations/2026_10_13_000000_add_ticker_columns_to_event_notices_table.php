<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * ホームの電光掲示板に流すための設定。
     * - ticker_lead_minutes: 開始の何分前から流すか。null のときは流さない
     * - ticker_after_minutes: 開始から何分後まで流すか。null のときは 20 分
     */
    public function up(): void
    {
        Schema::table('event_notices', function (Blueprint $table) {
            if (! Schema::hasColumn('event_notices', 'ticker_lead_minutes')) {
                $table->unsignedSmallInteger('ticker_lead_minutes')->nullable();
            }
            if (! Schema::hasColumn('event_notices', 'ticker_after_minutes')) {
                $table->unsignedSmallInteger('ticker_after_minutes')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('event_notices', function (Blueprint $table) {
            if (Schema::hasColumn('event_notices', 'ticker_after_minutes')) {
                $table->dropColumn('ticker_after_minutes');
            }
            if (Schema::hasColumn('event_notices', 'ticker_lead_minutes')) {
                $table->dropColumn('ticker_lead_minutes');
            }
        });
    }
};
