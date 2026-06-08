<?php

namespace App\Support;

/**
 * JWT HS256 编解码（纯加密，无 DB 依赖）。access token 的签发与校验都经此。
 */
class JwtCodec
{
    /** 用给定 payload 签发紧凑 JWT。 */
    public function encode(array $payload): string
    {
        $head = $this->base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
        $body = $this->base64url(json_encode($payload, JSON_UNESCAPED_SLASHES));
        $sig = $this->base64url(hash_hmac('sha256', "{$head}.{$body}", $this->secret(), true));
        return "{$head}.{$body}.{$sig}";
    }

    /** 校验签名与过期时间；非法或过期返回 null。 */
    public function decode(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$head, $body, $sig] = $parts;
        $expected = $this->base64url(hash_hmac('sha256', "{$head}.{$body}", $this->secret(), true));
        if (!hash_equals($expected, $sig)) {
            return null;
        }
        $payload = json_decode($this->base64urlDecode($body), true);
        if (!is_array($payload) || (int) ($payload['exp'] ?? 0) < time()) {
            return null;
        }
        return $payload;
    }

    public function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64urlDecode(string $data): string
    {
        return base64_decode(strtr($data . str_repeat('=', (4 - strlen($data) % 4) % 4), '-_', '+/')) ?: '';
    }

    private function secret(): string
    {
        return env('JWT_SECRET', env('APP_KEY', 'hellotime-laravel-dev-secret-0001'));
    }
}
