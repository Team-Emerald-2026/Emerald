<?php

return [
    'login_id' => env('ADMIN_LOGIN_ID'),
    'password' => env('ADMIN_PASSWORD'),
    // 管理画面UI用。APIは auth:sanctum + 管理者ロール必須のため、この値だけでは公開されない。
    'public_access' => filter_var(env('ADMIN_PUBLIC_ACCESS', false), FILTER_VALIDATE_BOOL),
];
