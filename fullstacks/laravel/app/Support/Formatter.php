<?php

namespace App\Support;

use DateTimeImmutable;

/**
 * Blade 视图用的展示格式化助手（纯函数）。通过 View::share 以 $fmt 注入所有模板。
 */
class Formatter
{
    public function formatDate(string $iso): string
    {
        return (new DateTimeImmutable($iso))->format('Y/m/d');
    }

    public function formatDateTime(string $iso): string
    {
        return (new DateTimeImmutable($iso))->format('Y/m/d H:i');
    }

    public function countdownText(string $iso): string
    {
        $diff = max(0, (new DateTimeImmutable($iso))->getTimestamp() - time());
        $days = intdiv($diff, 86400);
        $hours = intdiv($diff % 86400, 3600);
        $mins = intdiv($diff % 3600, 60);
        $secs = $diff % 60;
        return sprintf('还剩 %d 天 · %02d:%02d:%02d', $days, $hours, $mins, $secs);
    }

    public function shortName(string $name): string
    {
        return mb_strlen($name) > 4 ? mb_substr($name, 0, 4) . '…' : $name;
    }
}
