<?php

return [
    'app_host'         => env('APP_HOST', ''),
    'app_debug'        => env('APP_DEBUG', false),
    'app_trace'        => false,
    'default_timezone' => 'Asia/Shanghai',
    'default_app'      => 'index',
    'default_lang'     => 'zh-cn',
    'auto_multi_app'   => false,
    'show_error_msg'   => true,
    'exception_handle' => \app\ExceptionHandle::class,
];
