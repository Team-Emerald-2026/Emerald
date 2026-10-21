<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminAuthController extends Controller
{
    public function login(Request $request)
    {
        $validated = $request->validate([
            'login_id' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->where('login_id', $validated['login_id'])
            ->where('role', 'admin')
            ->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            AuditLog::record($request, 'admin.login_failed', $validated['login_id'], [
                'reason' => $user ? 'wrong_password' : 'unknown_login_id',
            ]);
            throw new AuthenticationException();
        }

        AuditLog::record($request, 'admin.login', $user->login_id);

        return response()->json([
            'token' => $user->createToken('admin-token')->plainTextToken,
            'role' => $user->role,
            'login_id' => $user->login_id,
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }
}
