<?php

namespace Tests\Unit;

use App\Support\JwtCodec;
use PHPUnit\Framework\TestCase;

class JwtCodecTest extends TestCase
{
    private JwtCodec $jwt;

    protected function setUp(): void
    {
        parent::setUp();
        $this->jwt = new JwtCodec();
    }

    public function test_encode_decode_round_trip(): void
    {
        $payload = ['sub' => 'user-1', 'exp' => time() + 900, 'nickname' => 'alice'];
        $token = $this->jwt->encode($payload);

        $this->assertStringContainsString('.', $token);
        $decoded = $this->jwt->decode($token);
        $this->assertIsArray($decoded);
        $this->assertSame('user-1', $decoded['sub']);
        $this->assertSame('alice', $decoded['nickname']);
    }

    public function test_expired_token_returns_null(): void
    {
        $payload = ['sub' => 'user-1', 'exp' => time() - 1];
        $token = $this->jwt->encode($payload);

        $this->assertNull($this->jwt->decode($token));
    }

    public function test_tampered_token_returns_null(): void
    {
        $payload = ['sub' => 'user-1', 'exp' => time() + 900];
        $token = $this->jwt->encode($payload);

        // 篡改 payload 部分
        $parts = explode('.', $token);
        $parts[1] = $this->jwt->base64url(json_encode(['sub' => 'hacker', 'exp' => time() + 900]));
        $tampered = implode('.', $parts);

        $this->assertNull($this->jwt->decode($tampered));
    }

    public function test_malformed_token_returns_null(): void
    {
        $this->assertNull($this->jwt->decode('not.a.jwt.at.all'));
        $this->assertNull($this->jwt->decode(''));
        $this->assertNull($this->jwt->decode('onlyone'));
    }

    public function test_base64url_no_padding(): void
    {
        $encoded = $this->jwt->base64url('hello world');
        $this->assertStringNotContainsString('=', $encoded);
        $this->assertStringNotContainsString('+', $encoded);
        $this->assertStringNotContainsString('/', $encoded);
    }
}
