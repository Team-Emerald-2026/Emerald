<?php

return [
    'login_id' => env('ADMIN_LOGIN_ID', 'admin'),
    'password' => env('ADMIN_PASSWORD', 'password'),
    // 一時的に管理画面APIをログインなしで公開する。戻すときは false にする。
    'public_access' => filter_var(env('ADMIN_PUBLIC_ACCESS', true), FILTER_VALIDATE_BOOL),
];
