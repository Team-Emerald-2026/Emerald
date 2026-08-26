<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'store_name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:1000'],
            'login_id' => ['required', 'string', 'max:255', 'unique:users,login_id'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $result = DB::transaction(function () use ($validated) {
            $storeId = 'store-' . Str::lower(Str::random(8));

            // IDが万一衝突したら作り直す
            while (Store::query()->whereKey($storeId)->exists()) {
                $storeId = 'store-' . Str::lower(Str::random(8));
            }

            $store = Store::query()->create([
                'id' => $storeId,
                'name' => $validated['store_name'],
                'description' => $validated['description'] ?? null,
                'is_open' => true,
                'current_wait_min' => 0,
                'current_queue_count' => 0,
            ]);

            $user = User::query()->create([
                'store_id' => $store->id,
                'login_id' => $validated['login_id'],
                'password' => Hash::make($validated['password']),
                'role' => 'store',
            ]);

            $token = $user->createToken('api-token')->plainTextToken;

            return [
                'token' => $token,
                'store_id' => $store->id,
                'store_name' => $store->name,
                'login_id' => $user->login_id,
                'role' => $user->role,
            ];
        });

        return response()->json($result, 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'login_id' => ['required'],
            'password' => ['required'],
        ]);

        $user = User::where('login_id', $request->login_id)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw new AuthenticationException();
        }

        $token = $user->createToken('api-token')->plainTextToken;

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