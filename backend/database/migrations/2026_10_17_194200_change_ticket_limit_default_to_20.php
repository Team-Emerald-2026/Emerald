<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 整理券の枚数の既定を50から20へ変更する。
     * まだ50のまま（旧既定のまま）の店舗も20にする。
     */
    public function up(): void
    {
        if (! Schema::hasColumn('stores', 'ticket_limit')) {
            return;
        }

        $this->changeTicketLimitDefault(20);
        DB::table('stores')->where('ticket_limit', 50)->update(['ticket_limit' => 20]);
    }

    public function down(): void
    {
        if (! Schema::hasColumn('stores', 'ticket_limit')) {
            return;
        }

        $this->changeTicketLimitDefault(50);
    }

    private function changeTicketLimitDefault(int $default): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            // テスト用 SQLite は列の既定変更を省略する（新規作成時の既定は元のマイグレーション側）
            return;
        }

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE stores MODIFY ticket_limit INT UNSIGNED NOT NULL DEFAULT {$default}");

            return;
        }

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE stores ALTER COLUMN ticket_limit SET DEFAULT {$default}");

            return;
        }

        Schema::table('stores', function (Blueprint $table) use ($default) {
            $table->unsignedInteger('ticket_limit')->default($default)->change();
        });
    }
};
