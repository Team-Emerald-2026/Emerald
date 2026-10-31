<?php

return [

    /*
    | アクセスログを残すか。テストでは無効にし、必要なテストだけ有効にする。
    | 環境変数は "true" / "false" の文字列で渡す。
    */
    'enabled' => env('ACCESS_LOG_ENABLED', 'true') === 'true',

    'log_directory' => env('ACCESS_LOG_DIRECTORY', storage_path('logs/access')),

    // このミリ秒以上かかったリクエストを「遅かった」として数える
    'slow_ms' => (int) env('ACCESS_LOG_SLOW_MS', 1000),

];
