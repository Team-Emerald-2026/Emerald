<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 整理券の枚数の既定を20から10へ変更する。
     * まだ20または50のまま（旧既定のまま）の店舗も10にする。
     */
    public function up(): void
    {
        if (! Schema::hasColumn('stores', 'ticket_limit')) {
            return;
        }

        try {
            $this->changeTicketLimitDefault(10);
        } catch (\Throwable) {
            // 列の既定を変えられなくても、既存の20・50は10に直す
        }

        DB::table('stores')->whereIn('ticket_limit', [20, 50])->update(['ticket_limit' => 10]);
    }

    public function down(): void
    {
        if (! Schema::hasColumn('stores', 'ticket_limit')) {
            return;
        }

        $this->changeTicketLimitDefault(20);
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
