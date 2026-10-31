<?php

use App\Models\AuditLog;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('audit:recent {--limit=50} {--target=} {--action=}', function () {
    $logs = AuditLog::query()
        ->when($this->option('target'), fn ($query, $target) => $query->where('target_id', $target))
        ->when($this->option('action'), fn ($query, $action) => $query->where('action', 'like', $action.'%'))
        ->orderByDesc('id')
        ->limit(max(1, (int) $this->option('limit')))
        ->get();

    if ($logs->isEmpty()) {
        $this->info('記録はありません。');

        return;
    }

    $this->table(
        ['日時(日本時間)', '操作', '誰が', '対象', '内容', 'IP'],
        $logs->map(fn (AuditLog $log) => [
            $log->created_at?->timezone('Asia/Tokyo')->format('m/d H:i:s'),
            $log->action,
            $log->actor_login_id ?? '-',
            $log->target_id ?? '-',
            $log->details ? json_encode($log->details, JSON_UNESCAPED_UNICODE) : '',
            $log->ip ?? '-',
        ])->all(),
    );
})->purpose('管理操作とログインの記録を新しい順に表示する');
