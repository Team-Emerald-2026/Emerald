<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

abstract class Controller
{
    protected function errorResponse(
        string $code,
        string $message,
        int $status,
        array $details = [],
    ): JsonResponse {
        return response()->json([
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details,
            ],
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }

    protected function notFoundResponse(string $message, string $field = 'id'): JsonResponse
    {
        return $this->errorResponse('NOT_FOUND', $message, 404, ['field' => $field]);
    }

    protected function forbiddenResponse(string $message): JsonResponse
    {
        return $this->errorResponse('FORBIDDEN', $message, 403);
    }

    protected function conflictResponse(string $message, array $details = []): JsonResponse
    {
        return $this->errorResponse('CONFLICT', $message, 409, $details);
    }
}
