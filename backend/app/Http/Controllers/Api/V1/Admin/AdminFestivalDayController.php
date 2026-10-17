<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\FestivalSetting;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class AdminFestivalDayController extends Controller
{
    public function show(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json([
            'data' => $this->payload(),
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    /**
     * 学園祭の「今日」を切り替える。
     * 来場者画面の初期選択日・モニターの表示日になる。
     * 各店舗の表示／非表示（is_visible）は触らない（来場者は日付フィルタで両日を見られる）。
     */
    public function update(Request $request)
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'day' => ['required', 'string', Rule::in(FestivalSetting::allowedDays())],
        ]);

        FestivalSetting::setCurrentDay($validated['day']);

        return response()->json([
            'data' => $this->payload(),
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function payload(): array
    {
        $current = FestivalSetting::currentDay();
        $counts = [
            'day1' => 0,
            'day2' => 0,
            'both' => 0,
        ];

        if (Schema::hasColumn('stores', 'exhibition_day')) {
            $rows = Store::query()
                ->selectRaw('exhibition_day, count(*) as aggregate')
                ->groupBy('exhibition_day')
                ->pluck('aggregate', 'exhibition_day');

            foreach ($counts as $key => $_) {
                $counts[$key] = (int) ($rows[$key] ?? 0);
            }
        }

        return [
            'current_day' => $current,
            'store_counts' => $counts,
        ];
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }
}
