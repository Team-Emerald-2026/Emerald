<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 総当たり対策はアカウント単位で数える。学内Wi-Fiなどで全店舗が同じIPになっても、
        // 朝の一斉ログインで他の店舗まで弾かれないようにする
        RateLimiter::for('login', function (Request $request) {
            $loginId = Str::lower(trim((string) $request->input('login_id')));
            // Render の前段の Cloudflare が実際の接続元を入れるヘッダー。
            // X-Forwarded-For だと Cloudflare のIP（毎回変わる）を拾ってしまう
            $ip = (string) ($request->header('CF-Connecting-IP') ?: $request->ip());

            return [
                Limit::perMinute(5)->by('login:'.$request->path().'|'.$loginId.'|'.$ip),
                Limit::perMinute(60)->by('login-ip:'.$ip),
            ];
        });
    }
}
