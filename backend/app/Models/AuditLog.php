<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * 管理操作とログインの記録。デプロイしても消えないよう DB に残す。
 * パスワードそのものは絶対に details に入れない。
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'action',
        'actor_login_id',
        'target_id',
        'details',
        'ip',
    ];

    protected $casts = [
        'details' => 'array',
        'created_at' => 'datetime',
    ];

    public static function record(Request $request, string $action, ?string $targetId = null, array $details = []): void
    {
        try {
            static::query()->create([
                'action' => $action,
                'actor_login_id' => $request->user()?->login_id,
                'target_id' => $targetId === null ? null : Str::limit($targetId, 250, ''),
                'details' => $details === [] ? null : $details,
                'ip' => Str::limit((string) ($request->header('CF-Connecting-IP') ?: $request->ip()), 45, ''),
            ]);
        } catch (\Throwable $exception) {
            // 記録に失敗しても、店舗の保存やログインは止めない
            Log::warning('audit log failed: '.$exception->getMessage(), ['action' => $action]);
        }
    }
}
