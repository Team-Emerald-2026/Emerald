<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\ApiAccessLog;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AdminAccessLogController extends Controller
{
    public function __construct(private readonly ApiAccessLog $accessLog) {}

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json([
            'data' => $this->accessLog->summarize($this->date($request)),
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public function download(Request $request)
    {
        $this->authorizeAdmin($request);

        $date = $this->date($request);
        $path = $this->accessLog->readablePath($date);
        abort_if($path === null, 404, '指定した日のアクセスログはありません。');

        return response()->download($path, 'access-'.$date.'.txt', [
            'Content-Type' => 'text/plain; charset=UTF-8',
        ]);
    }

    private function date(Request $request): string
    {
        $date = $request->query('date');
        if ($date === null || $date === '') {
            return Carbon::now('Asia/Tokyo')->toDateString();
        }

        abort_unless(
            is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1,
            422,
            '日付は YYYY-MM-DD で指定してください。',
        );

        [$year, $month, $day] = array_map('intval', explode('-', $date));
        abort_unless(checkdate($month, $day, $year), 422, '日付は YYYY-MM-DD で指定してください。');

        return $date;
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }
}
