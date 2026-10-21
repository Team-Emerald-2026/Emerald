<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'login_id' => ['required'],
            'password' => ['required'],
        ]);

        $user = User::query()
            ->where('login_id', $request->login_id)
            ->where('role', 'store')
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            $attempted = $request->input('login_id');
            AuditLog::record($request, 'store.login_failed', is_string($attempted) ? $attempted : null, [
                'reason' => $user ? 'wrong_password' : 'unknown_login_id',
            ]);
            throw new AuthenticationException();
        }

        $token = $user->createToken('api-token')->plainTextToken;
        AuditLog::record($request, 'store.login', $user->login_id, ['store_id' => $user->store_id]);

        return response()->json([
            'token' => $token,
            'store_id' => $user->store_id,
            'role' => $user->role,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }
}