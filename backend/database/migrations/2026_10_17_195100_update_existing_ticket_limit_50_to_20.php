<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 店舗情報に保存されている旧既定（50枚）を20枚へ直す。
     * 画面はDBの値を出すため、コードの既定だけ変えてもハードリロードでは直らない。
     */
    public function up(): void
    {
        if (! Schema::hasColumn('stores', 'ticket_limit')) {
            return;
        }

        DB::table('stores')->where('ticket_limit', 50)->update(['ticket_limit' => 20]);
    }

    public function down(): void
    {
        // 意図して20にした店舗まで50に戻さない
    }
};
