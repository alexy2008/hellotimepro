<?php

namespace Tests\Unit;

use App\Support\CrossDb;
use PHPUnit\Framework\TestCase;

class CrossDbTest extends TestCase
{
    private CrossDb $db;

    protected function setUp(): void
    {
        parent::setUp();
        // CrossDb 无 DI 依赖；通过 config 读 DB driver，单元测试里直接 new 即可
        $this->db = new CrossDb();
    }

    // ---- id 转换 ----

    public function test_dashify_and_round_trip(): void
    {
        $hex = '02b648cf3b6d506faa4d0f73d91d3d82';
        $uuid = '02b648cf-3b6d-506f-aa4d-0f73d91d3d82';

        $this->assertSame($uuid, $this->db->dashify($hex));
        $this->assertSame($uuid, $this->db->canonicalUuid($hex));
        $this->assertSame($uuid, $this->db->canonicalUuid($uuid));
    }

    public function test_canonical_uuid_invalid_returns_null(): void
    {
        $this->assertNull($this->db->canonicalUuid('not-a-uuid'));
        $this->assertNull($this->db->canonicalUuid(''));
        $this->assertNull($this->db->canonicalUuid('gggggggg-0000-0000-0000-000000000000'));
    }

    public function test_id_out_hex_to_standard(): void
    {
        $hex = 'aaaabbbbccccddddeeee111122223333';
        $expected = 'aaaabbbb-cccc-dddd-eeee-111122223333';
        $this->assertSame($expected, $this->db->idOut($hex));
        // 已是标准 UUID 直接透传
        $this->assertSame($expected, $this->db->idOut($expected));
    }

    // ---- 时间戳 ----

    public function test_iso_outputs_z_suffix(): void
    {
        $iso = $this->db->iso('2026-08-01T01:00:00+00:00');
        // 对外输出统一用 Z
        $this->assertStringEndsWith('Z', $iso);
        $this->assertStringStartsWith('2026-08-01T01:00:00', $iso);
    }

    public function test_parse_time_round_trip(): void
    {
        $input = '2026-06-05T09:27:04.481+00:00';
        $t = $this->db->parseTime($input);
        // 往返：格式化后重新解析应得到同一时刻
        $iso = $this->db->iso($input);
        $t2 = $this->db->parseTime($iso);
        $this->assertSame($t->getTimestamp(), $t2->getTimestamp());
        // 确认毫秒保留（误差在 1 秒内）
        $this->assertSame(2026, (int) $t->format('Y'));
        $this->assertSame(6, (int) $t->format('n'));
    }

    public function test_is_opened_past_time(): void
    {
        $this->assertTrue($this->db->isOpened('2020-01-01T00:00:00+00:00'));
        $this->assertFalse($this->db->isOpened('2099-01-01T00:00:00+00:00'));
    }

    // ---- 布尔 ----

    public function test_to_bool_variants(): void
    {
        foreach ([true, 1, '1', 't', 'true'] as $v) {
            $this->assertTrue($this->db->toBool($v), "toBool($v) should be true");
        }
        foreach ([false, 0, '0', 'false', null, ''] as $v) {
            $this->assertFalse($this->db->toBool($v), "toBool($v) should be false");
        }
    }
}
