<?php

namespace App\Support;

/**
 * 输入校验规则（纯函数，无状态）。在双通道（/api JSON 与 SSR Blade）共用同一套规则，
 * 避免两条通道校验口径漂移。
 */
class Validation
{
    public function email(string $email): bool
    {
        return $email !== ''
            && strlen($email) <= 254
            && filter_var($email, FILTER_VALIDATE_EMAIL) !== false
            && $email === strtolower($email);
    }

    public function password(string $password): bool
    {
        $len = mb_strlen($password, 'UTF-8');
        return $len >= 8 && $len <= 128 && preg_match('/[A-Za-z]/', $password) && preg_match('/\d/', $password);
    }

    public function nickname(string $nickname): bool
    {
        return preg_match('/^[\p{L}\p{N}_-]{2,20}$/u', $nickname) === 1;
    }
}
