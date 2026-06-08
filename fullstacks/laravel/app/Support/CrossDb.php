<?php

namespace App\Support;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * 跨库基础设施层：屏蔽 PostgreSQL 与 SQLite 在 id、时间戳、布尔三处的存储差异，
 * 并提供原始 SQL 读取的薄封装。所有领域服务通过它访问底层而不直接关心驱动。
 *
 * - id：SQLite 用 32 位无横线 hex（与 spec/db seed 对齐），Postgres 用标准带横线 UUID；对外一律输出标准 UUID。
 * - 时间戳：SQLite 用 ISO-8601 `T…+00:00` 文本，Postgres 用 timestamptz；对外一律输出 `…Z`。
 * - 布尔：SQLite 用 0/1，Postgres 用 'true'/'false' 文本（与 schema 一致）。
 */
class CrossDb
{
    public function driver(): string
    {
        return config('database.default') === 'pgsql' ? 'pgsql' : 'sqlite';
    }

    public function isSqlite(): bool
    {
        return $this->driver() === 'sqlite';
    }

    // ---- 原始 SQL 读取封装 ----

    public function row(string $sql, array $params = []): ?array
    {
        return $this->toArray(DB::selectOne($sql, $params));
    }

    public function rows(string $sql, array $params = []): array
    {
        return array_map(fn ($row) => (array) $row, DB::select($sql, $params));
    }

    public function toArray(mixed $row): ?array
    {
        return $row ? (array) $row : null;
    }

    // ---- 布尔 ----

    public function boolParam(bool $value): mixed
    {
        return $this->isSqlite() ? ($value ? 1 : 0) : ($value ? 'true' : 'false');
    }

    public function toBool(mixed $value): bool
    {
        return $value === true || $value === 1 || $value === '1' || $value === 't' || $value === 'true';
    }

    // ---- 时间戳 ----

    public function nowDb(): string
    {
        return $this->dbTimestamp(new DateTimeImmutable('now', new DateTimeZone('UTC')));
    }

    public function dbTimestamp(DateTimeImmutable $dt): string
    {
        $utc = $dt->setTimezone(new DateTimeZone('UTC'));
        if ($this->driver() === 'pgsql') {
            return $utc->format('Y-m-d H:i:s.vP');
        }
        // SQLite：与 spec/db seed 对齐——ISO-8601、T 分隔、+00:00，零小数不输出，
        // 靠字符串字典序支撑 open_at <= now / ORDER BY created_at，并与演示数据可比。
        $base = $utc->format('Y-m-d\TH:i:s');
        if ((int) $utc->format('u') > 0) {
            $base .= '.' . rtrim($utc->format('u'), '0');
        }
        return $base . '+00:00';
    }

    public function iso(mixed $value): string
    {
        return $this->parseTime($value)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }

    public function parseTime(mixed $value): DateTimeImmutable
    {
        return new DateTimeImmutable((string) $value, new DateTimeZone('UTC'));
    }

    public function isOpened(mixed $value): bool
    {
        return $this->parseTime($value) <= new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    // ---- id ----

    /** 生成存储格式 id：SQLite 32-hex（与 seed 对齐），Postgres 标准 UUID。 */
    public function newId(): string
    {
        $uuid = strtolower((string) Str::uuid());
        return $this->isSqlite() ? str_replace('-', '', $uuid) : $uuid;
    }

    /** 校验并规范化客户端传入 id（接受带横线或 32-hex），非法返回 null（调用方据此转 404，避免 PG uuid 类型 500）。 */
    public function canonicalUuid(string $value): ?string
    {
        $v = strtolower(trim($value));
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $v)) {
            return $v;
        }
        if (preg_match('/^[0-9a-f]{32}$/', $v)) {
            return $this->dashify($v);
        }
        return null;
    }

    public function dashify(string $hex): string
    {
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
    }

    /** 规范 UUID（带横线）→ 存储格式，用于 WHERE/INSERT 绑定。 */
    public function idToDb(string $canonical): string
    {
        return $this->isSqlite() ? str_replace('-', '', $canonical) : $canonical;
    }

    /** 存储值 → 规范 UUID（带横线），用于 API 输出，保证两套驱动对外都是标准 UUID。 */
    public function idOut(mixed $value): string
    {
        $v = strtolower((string) $value);
        return (strlen($v) === 32 && ctype_xdigit($v)) ? $this->dashify($v) : $v;
    }
}
