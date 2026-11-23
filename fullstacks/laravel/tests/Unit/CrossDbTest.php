<?php

namespace Tests\Unit;

use App\Support\CrossDb;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;

class CrossDbTest extends TestCase
{
    private CrossDb $db;

    protected function setUp(): void
    {
        parent::setUp();
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
        $this->assertNull($this->db->canonicalUuid('1-1-1-1-1'));
        $this->assertNull($this->db->canonicalUuid('gggggggg-0000-0000-0000-000000000000'));
    }

    public function test_id_out_hex_to_standard(): void
    {
        $hex = 'aaaabbbbccccddddeeee111122223333';
        $expected = 'aaaabbbb-cccc-dddd-eeee-111122223333';
        $this->assertSame($expected, $this->db->idOut($hex));
        $this->assertSame($expected, $this->db->idOut($expected));
    }

    // ---- 时间戳与日历年上限 ----

    public function test_iso_outputs_z_suffix(): void
    {
        $iso = $this->db->iso('2026-08-01T01:00:00+00:00');
        $this->assertStringEndsWith('Z', $iso);
        $this->assertStringStartsWith('2026-08-01T01:00:00', $iso);
    }

    public function test_parse_time_round_trip(): void
    {
        $input = '2026-06-05T09:27:04.481+00:00';
        $t = $this->db->parseTime($input);
        $iso = $this->db->iso($input);
        $t2 = $this->db->parseTime($iso);
        $this->assertSame($t->getTimestamp(), $t2->getTimestamp());
        $this->assertSame(2026, (int) $t->format('Y'));
        $this->assertSame(6, (int) $t->format('n'));
    }

    public function test_is_opened_past_time(): void
    {
        $this->assertTrue($this->db->isOpened('2020-01-01T00:00:00+00:00'));
        $this->assertFalse($this->db->isOpened('2099-01-01T00:00:00+00:00'));
    }

    public function test_add_calendar_years_handles_leap_day_without_overflow(): void
    {
        $leap = new DateTimeImmutable('2028-02-29T08:15:30.500000Z', new DateTimeZone('UTC'));
        $tenLater = $this->db->addCalendarYears($leap, 10);
        // 2038 非闰年：显式回退到 2 月 28 日，不能进位成 3 月 1 日
        $this->assertSame('2038-02-28T08:15:30.500000+00:00', $tenLater->format('Y-m-d\TH:i:s.uP'));

        // 目标年本身是闰年时保留 2 月 29 日
        $fourLater = $this->db->addCalendarYears($leap, 4);
        $this->assertSame('2032-02-29T08:15:30.500000+00:00', $fourLater->format('Y-m-d\TH:i:s.uP'));

        // 普通日期保持同一月日
        $normal = new DateTimeImmutable('2026-11-23T12:00:00Z', new DateTimeZone('UTC'));
        $this->assertSame('2036-11-23T12:00:00+00:00', $this->db->addCalendarYears($normal, 10)->format('Y-m-d\TH:i:sP'));
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
