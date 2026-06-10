<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * 跨库布尔 Cast：屏蔽 PostgreSQL 与 SQLite 的布尔存储差异。
 *
 * 为什么不能用 Eloquent 原生 'boolean' cast：PDO pgsql 把 boolean 列读回成 't'/'f'
 * 字符串，而原生 cast 等价于 (bool)$value——`(bool)'f'` 竟为 true，会把「未公开」误判成
 * 「公开」。这里读时做显式归一，写时按驱动产出列兼容的字面量。
 *
 * - 读：SQLite 0/1、Postgres 't'/'f' → PHP bool
 * - 写：SQLite → 0/1，Postgres → 'true'/'false'（boolean 列接受的文本字面量）
 */
class CrossDbBoolean implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): bool
    {
        return $value === true || $value === 1 || $value === '1' || $value === 't' || $value === 'true';
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        $bool = (bool) $value;

        return $model->getConnection()->getDriverName() === 'pgsql'
            ? ($bool ? 'true' : 'false')
            : ($bool ? 1 : 0);
    }
}
