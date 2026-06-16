<?php

return [
    'default' => env('CACHE_DRIVER', 'file'),
    'stores'  => [
        'file' => [
            'type'       => 'File',
            'path'       => '',
            'prefix'     => '',
            'expire'     => 0,
            'serialize'  => [],
        ],
    ],
];
