<?php

namespace App\Http\Middleware;

use App\Services\ApiAccessLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RecordApiAccess
{
    public function __construct(private readonly ApiAccessLog $accessLog) {}

    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set('api_access_started_ns', hrtime(true));

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        if (! $request->is('api/*')) {
            return;
        }

        $started = $request->attributes->get('api_access_started_ns');
        $milliseconds = is_int($started)
            ? (int) ((hrtime(true) - $started) / 1_000_000)
            : 0;

        $this->accessLog->write($request, $response->getStatusCode(), $milliseconds);
    }
}
