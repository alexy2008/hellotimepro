<?php

namespace App\Support;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Str;

/**
 * 跨库格式基础设施：屏蔽 PostgreSQL 与 SQLite 在 id、时间戳、布尔三处的存储差异。
 * 数据访问统一走 Eloquent；本类负责「存储格式 ↔ 对外契约」的边界换算，供模型 Cast、
 * 服务层（查询绑定/写入）与 Mapper（输出）复用。
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

    public function nowUtc(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    public function nowDb(): string
    {
        return $this->dbTimestamp($this->nowUtc());
    }

    public function dbTimestamp(DateTimeImmutable $dt): string
    {
        $utc = $dt->setTimezone(new DateTimeZone('UTC'));
        if ($this->driver() === 'pgsql') {
            return $utc->format('Y-m-d H:i:s.uP');
        }
        // SQLite：固定 6 位微秒的 ISO-8601 UTC（T 分隔、+00:00），与整秒种子文本按字典序严格可比
        return $utc->format('Y-m-d\TH:i:s.u+00:00');
    }

    /**
     * 往后数若干个日历年的同一时刻（UTC）；目标年没有该日期（2 月 29 日）时显式回退到 2 月 28 日，
     * 不让 DateTime 把非闰年 2/29 进位成 3/1。
     */
    public function addCalendarYears(DateTimeImmutable $dt, int $years): DateTimeImmutable
    {
        $utc = $dt->setTimezone(new DateTimeZone('UTC'));
        $targetYear = (int) $utc->format('Y') + $years;
        $month = (int) $utc->format('n');
        $day = (int) $utc->format('j');
        if ($month === 2 && $day === 29) {
            $isLeap = ($targetYear % 4 === 0 && ($targetYear % 100 !== 0 || $targetYear % 400 === 0));
            if (!$isLeap) {
                $day = 28;
            }
        }
        return $utc->setDate($targetYear, $month, $day);
    }

    public function iso(mixed $value): string
    {
        return $this->parseTime($value)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }

    public function parseTime(mixed $value): DateTimeImmutable
    {
        return new DateTimeImmutable((string) $value, new DateTimeZone('UTC'));
    }

    public function isOpened(mixed $value, ?DateTimeImmutable $now = null): bool
    {
        $ref = $now ? $now->setTimezone(new DateTimeZone('UTC')) : $this->nowUtc();
        return $this->parseTime($value)->setTimezone(new DateTimeZone('UTC')) <= $ref;
    }

    // ---- id ----

    /** 生成存储格式 id：SQLite 32-hex（与 seed 对齐），Postgres 标准 UUID。 */
    public function newId(): string
    {
        $uuid = strtolower((string) Str::uuid());
        return $this->isSqlite() ? str_replace('-', '', $uuid) : $uuid;
    }

    /** 校验并规范化客户端传入 id（接受带横线标准 UUID 或 32 位十六进制），非法返回 null。 */
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

    /** 规范 UUID（带横线）→ 当前驱动写入格式。 */
    public function idToDb(string $canonical): string
    {
        return $this->isSqlite() ? str_replace('-', '', $canonical) : $canonical;
    }

    /**
     * 查询匹配候选列表：SQLite 种子为 32-hex、其他工具可能写入带横线 UUID，
     * 查找时两种格式都匹配，后续写外键 / 删除一律使用查到的原始主键。
     */
    public function idCandidates(string $canonical): array
    {
        if ($this->isSqlite()) {
            $hex = str_replace('-', '', $canonical);
            return [$hex, $canonical];
        }
        return [$canonical];
    }

    /** 存储值 → 规范 UUID（带横线），用于 API 输出，保证两套驱动对外都是标准 UUID。 */
    public function idOut(mixed $value): string
    {
        $v = strtolower((string) $value);
        return (strlen($v) === 32 && ctype_xdigit($v)) ? $this->dashify($v) : $v;
    }
}
