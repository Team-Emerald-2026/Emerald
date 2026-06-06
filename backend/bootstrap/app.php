<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $renderApiError = static function (
            string $code,
            string $message,
            int $status,
            mixed $details = null,
        ) {
            return response()->json([
                'error' => [
                    'code' => $code,
                    'message' => $message,
                    'details' => $details,
                ],
            ], $status, [], JSON_UNESCAPED_UNICODE);
        };

        $isApiRequest = static function (Request $request): bool {
            return $request->is('api/*') || $request->expectsJson();
        };

        $exceptions->render(function (ValidationException $e, Request $request) use ($renderApiError, $isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return $renderApiError(
                'INVALID_PARAMS',
                __('errors.invalid_params'),
                422,
                $e->errors(),
            );
        });

        $exceptions->render(function (ModelNotFoundException $e, Request $request) use ($renderApiError, $isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return $renderApiError(
                'NOT_FOUND',
                __('errors.not_found'),
                404,
                [
                    'model' => class_basename($e->getModel()),
                ],
            );
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($renderApiError, $isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return $renderApiError(
                'NOT_FOUND',
                __('errors.not_found'),
                404,
            );
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($renderApiError, $isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return $renderApiError(
                'UNAUTHORIZED',
                __('errors.unauthorized'),
                401,
            );
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) use ($renderApiError, $isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return $renderApiError(
                'FORBIDDEN',
                __('errors.forbidden'),
                403,
            );
        });

        $exceptions->render(function (Throwable $e, Request $request) use ($renderApiError, $isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return $renderApiError(
                'INTERNAL_ERROR',
                __('errors.internal_error'),
                500,
            );
        });
    })->create();
