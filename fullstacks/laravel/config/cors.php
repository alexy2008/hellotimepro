<?php

// CORS 配置：允许前端 SPA 和黑盒验证脚本以不同 Origin 访问 /api/v1/* 端点。
// Laravel 的 HandleCors 中间件会读取此文件；已在 bootstrap/app.php 中注册到 api 组。

return [
    'paths' => ['api/*', 'api/v1/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['*'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
