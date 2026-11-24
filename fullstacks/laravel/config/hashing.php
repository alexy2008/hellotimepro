<?php

return [

    'driver' => env('HASH_DRIVER', 'bcrypt'),

    /*
    |--------------------------------------------------------------------------
    | Bcrypt 跨技术栈兼容说明
    |--------------------------------------------------------------------------
    | HelloTime Pro 多技术栈共用同一数据库：演示数据与其他栈（Python / Go / Java /
    | Node / Ruby）会写入 $2a$ 或 $2b$ 前缀的 bcrypt 哈希，而 PHP 的 password_get_info()
    | 仅将 $2y$ 识别为 "bcrypt"。Laravel 默认开启 verify=true 时会在 Hash::check()
    | 直接抛出 RuntimeException("This password does not use the Bcrypt algorithm.")。
    | 关闭 verify 后，Hash::check() 直接调用 PHP 原生 password_verify()，可原生校验
    | $2a$ / $2b$ / $2y$ 全部 bcrypt 变体。
    */
    'bcrypt' => [
        'rounds' => env('BCRYPT_ROUNDS', 12),
        'verify' => env('HASH_VERIFY', false),
        'limit' => env('BCRYPT_LIMIT', null),
    ],

    'argon' => [
        'memory' => env('ARGON_MEMORY', 65536),
        'threads' => env('ARGON_THREADS', 1),
        'time' => env('ARGON_TIME', 4),
        'verify' => env('HASH_VERIFY', true),
    ],

    'rehash_on_login' => false,

];
