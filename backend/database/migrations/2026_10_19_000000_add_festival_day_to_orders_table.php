<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('orders', 'festival_day')) {
            Schema::table('orders', function (Blueprint $table) {
                // 会計を取ったときの開催日（day1 / day2）。未設定の過去分は null。
                $table->string('festival_day', 16)->nullable()->after('store_id');
                $table->index(['festival_day', 'status']);
            });
        }

        $dates = [
            '2026-10-24' => 'day1',
            '2026-10-25' => 'day2',
        ];

        DB::table('orders')
            ->whereNull('festival_day')
            ->orderBy('id')
            ->chunkById(200, function ($orders) use ($dates) {
                foreach ($orders as $order) {
                    $raw = $order->settled_at ?? $order->ordered_at ?? $order->created_at;
                    if (! $raw) {
                        continue;
                    }

                    $day = $dates[Carbon::parse($raw)->timezone('Asia/Tokyo')->toDateString()] ?? null;
                    if ($day === null) {
                        continue;
                    }

                    DB::table('orders')->where('id', $order->id)->update([
                        'festival_day' => $day,
                    ]);
                }
            });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('orders', 'festival_day')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['festival_day', 'status']);
            $table->dropColumn('festival_day');
        });
    }
};
