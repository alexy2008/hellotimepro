<?php

namespace App\Models\Concerns;

use App\Support\CrossDb;

/**
 * 字符串主键 + 跨库 id 生成。
 *
 * spec/db schema 下主键不是自增整数：SQLite 存 32 位无横线 hex、Postgres 存标准 UUID。
 * 模型创建时若未显式指定 id，按当前驱动生成存储格式 id（与演示数据 seed 对齐）。
 * 同时关闭 Eloquent 自带时间戳——created_at/updated_at 是跨库自定义格式，由服务显式写入。
 */
trait HasCrossDbKey
{
    public function initializeHasCrossDbKey(): void
    {
        $this->incrementing = false;
        $this->keyType = 'string';
        $this->timestamps = false;
    }

    protected static function bootHasCrossDbKey(): void
    {
        static::creating(function ($model): void {
            if ($model->getKeyName() === 'id' && empty($model->getAttribute('id'))) {
                $model->setAttribute('id', app(CrossDb::class)->newId());
            }
        });
    }
}
