<?php

return [
    'default'      => env('LOG_CHANNEL', 'file'),
    'channels'     => [
        'file' => [
            'type'           => 'File',
            'path'           => '',
            'single'         => false,
            'file_size'      => 2097152,
            'time_format'    => 'c',
            'apart_level'    => ['error', 'warning', 'info'],
            'max_files'      => 30,
            'json'           => false,
            'format'         => '[%s][%s] %s',
        ],
    ],
];
