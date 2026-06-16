<?php

return [
    'alias'    => [
        'auth'  => \app\middleware\AuthMiddleware::class,
        'admin' => \app\middleware\AdminMiddleware::class,
        'cors'  => \app\middleware\CorsMiddleware::class,
    ],
    'priority' => [],
];
