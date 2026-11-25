<?php

namespace Tests\Feature;

use App\Support\CrossDb;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * 2.0 后端核心回归测试（使用内存 SQLite，独立于开发库）：
 * - health 版本 2.0.0、头像 v2 目录
 * - plaza/stats 与 me/stats（含空集为 0/null、q 影响 counts 但不影响 farthest/next、字面匹配）
 * - 2.0 收藏口径（可收藏自己的、未公开的、未开启的）
 * - 删除胶囊连带删收藏（显式关闭 SQLite PRAGMA foreign_keys = OFF 验证不依赖外键级联）
 * - openAt 10 个日历年上限
 * - 路径 UUID 格式校验（GET /plaza/capsules/{id}、DELETE /me/capsules/{id}、DELETE /me/favorites/{id} → 422）
 */
class ApiV2RegressionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'database.connections.sqlite.foreign_key_constraints' => false,
        ]);
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $schema = file_get_contents(dirname(base_path(), 2) . '/spec/db/schema.sqlite.sql');
        DB::unprepared((string) $schema);
        // 显式关闭外键约束，证明删除连带收藏依赖显式 SQL 而非外键级联
        DB::statement('PRAGMA foreign_keys = OFF');
    }

    private function registerUser(string $email, string $nickname, string $password = 'Pass1234!'): array
    {
        $res = $this->postJson('/api/v1/auth/register', [
            'email' => $email,
            'password' => $password,
            'nickname' => $nickname,
            'avatarId' => 'neo',
        ]);
        $res->assertStatus(201);
        return $res->json('data');
    }

    private function createCapsule(string $token, array $overrides = []): array
    {
        $openAt = (new DateTimeImmutable('+2 hours', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/capsules', array_merge([
                'title' => '测试胶囊',
                'content' => '寄给未来的信',
                'openAt' => $openAt,
                'inPlaza' => true,
            ], $overrides));
        $res->assertStatus(201);
        return $res->json('data');
    }

    public function test_health_version_and_empty_stats(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('data.version', '2.0.0')
            ->assertJsonPath('data.stack.kind', 'fullstack');

        $this->getJson('/api/v1/plaza/stats')
            ->assertOk()
            ->assertJsonPath('data.counts', ['all' => 0, 'opened' => 0, 'unopened' => 0])
            ->assertJsonPath('data.farthestOpenAt', null)
            ->assertJsonPath('data.nextOpenAt', null);
    }

    public function test_favorite_2_0_rules_and_delete_cascade_without_sqlite_fk(): void
    {
        $owner = $this->registerUser('owner@example.com', '胶囊作者');
        $fan = $this->registerUser('fan@example.com', '收藏粉丝');

        // 未公开胶囊：作者自己和粉丝都能收藏
        $priv = $this->createCapsule($owner['accessToken'], ['title' => '私密胶囊', 'inPlaza' => false]);

        $this->withHeader('Authorization', 'Bearer ' . $owner['accessToken'])
            ->postJson('/api/v1/me/favorites', ['capsuleId' => $priv['id']])
            ->assertOk()
            ->assertJsonPath('data.favoriteCount', 1);

        $this->withHeader('Authorization', 'Bearer ' . $fan['accessToken'])
            ->postJson('/api/v1/me/favorites', ['capsuleId' => $priv['id']])
            ->assertOk()
            ->assertJsonPath('data.favoriteCount', 2);

        $this->withHeader('Authorization', 'Bearer ' . $owner['accessToken'])
            ->getJson('/api/v1/me/stats')
            ->assertOk()
            ->assertJsonPath('data', [
                'created' => 1,
                'opened' => 0,
                'unopened' => 1,
                'inPlaza' => 0,
                'favoritesReceived' => 2,
                'favoritesGiven' => 1,
            ]);

        // 确认外键已关闭，删除胶囊仍必须显式清空 favorites
        $fk = DB::selectOne('PRAGMA foreign_keys');
        $this->assertSame(0, (int) ($fk->foreign_keys ?? 1));

        $this->withHeader('Authorization', 'Bearer ' . $owner['accessToken'])
            ->deleteJson('/api/v1/me/capsules/' . $priv['id'])
            ->assertNoContent();

        $this->assertSame(0, DB::table('favorites')->count());
        $this->withHeader('Authorization', 'Bearer ' . $fan['accessToken'])
            ->getJson('/api/v1/me/stats')
            ->assertOk()
            ->assertJsonPath('data.favoritesGiven', 0);
    }

    public function test_plaza_stats_and_literal_search_escaping(): void
    {
        $u = $this->registerUser('search@example.com', '字面搜索者');
        $near = $this->createCapsule($u['accessToken'], [
            'title' => 'a_b 100% 匹配',
            'openAt' => (new DateTimeImmutable('+10 minutes', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z'),
        ]);
        $far = $this->createCapsule($u['accessToken'], [
            'title' => 'axb 干扰项',
            'openAt' => (new DateTimeImmutable('+5 years', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z'),
        ]);

        // 字面匹配 _ 与 %：不应把 _ 当作单字符通配符匹配 axb
        $statsUnder = $this->getJson('/api/v1/plaza/stats?q=' . urlencode('a_b'))
            ->assertOk()
            ->json('data');
        $this->assertSame(['all' => 1, 'opened' => 0, 'unopened' => 1], $statsUnder['counts']);
        // farthestOpenAt / nextOpenAt 不受 q 影响
        $this->assertSame($far['openAt'], $statsUnder['farthestOpenAt']);
        $this->assertSame($near['openAt'], $statsUnder['nextOpenAt']);

        $statsPct = $this->getJson('/api/v1/plaza/stats?q=' . urlencode('100%'))
            ->assertOk()
            ->json('data');
        $this->assertSame(1, $statsPct['counts']['all']);

        // q 超过 50 字符 → 422
        $this->getJson('/api/v1/plaza/stats?q=' . str_repeat('a', 51))
            ->assertStatus(422)
            ->assertJsonPath('errorCode', 'VALIDATION_ERROR');
    }

    public function test_open_at_calendar_year_limit(): void
    {
        $u = $this->registerUser('limit@example.com', '十年之约');
        $db = new CrossDb();
        $limit = $db->addCalendarYears($db->nowUtc(), 10);

        $okTime = $limit->modify('-60 seconds')->format('Y-m-d\TH:i:s.v\Z');
        $lateTime = $limit->modify('+60 seconds')->format('Y-m-d\TH:i:s.v\Z');

        $this->withHeader('Authorization', 'Bearer ' . $u['accessToken'])
            ->postJson('/api/v1/capsules', [
                'title' => '刚好十年内',
                'content' => 'ok',
                'openAt' => $okTime,
                'inPlaza' => true,
            ])
            ->assertStatus(201);

        $this->withHeader('Authorization', 'Bearer ' . $u['accessToken'])
            ->postJson('/api/v1/capsules', [
                'title' => '超出十年',
                'content' => 'too late',
                'openAt' => $lateTime,
                'inPlaza' => true,
            ])
            ->assertStatus(422)
            ->assertJsonPath('errorCode', 'VALIDATION_ERROR');
    }

    public function test_create_rejects_invalid_datetime_and_boolean_fields(): void
    {
        $u = $this->registerUser('invalid-capsule@example.com', '校验胶囊');
        $valid = [
            'title' => '待校验的胶囊',
            'content' => '寄给未来',
            'openAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 7200),
        ];

        foreach ([
            ['openAt', 'tomorrow'],
            ['openAt', (date('Y') + 1) . '-02-30T09:00:00Z'],
            ['inPlaza', 'maybe'],
            ['inPlaza', null],
        ] as [$field, $value]) {
            $this->withToken($u['accessToken'])
                ->postJson('/api/v1/capsules', array_replace($valid, [$field => $value]))
                ->assertUnprocessable()
                ->assertJsonPath('details.0.field', $field);
        }
        $this->assertDatabaseCount('capsules', 0);
    }

    public function test_registration_and_pagination_validate_declared_field_types(): void
    {
        $valid = ['email' => 'bad-fields@example.com', 'nickname' => '字段校验', 'password' => 'Pass1234!'];
        $this->postJson('/api/v1/auth/register', $valid)
            ->assertUnprocessable()
            ->assertJsonPath('details.0.field', 'avatarId');

        $this->postJson('/api/v1/auth/register', array_replace($valid, [
            'password' => '中文a1',
            'avatarId' => 'neo',
        ]))->assertUnprocessable()->assertJsonPath('details.0.field', 'password');

        foreach (['page' => '1.9', 'pageSize' => '50.9'] as $field => $value) {
            $this->getJson('/api/v1/plaza/capsules?' . http_build_query([$field => $value]))
                ->assertUnprocessable()
                ->assertJsonPath('details.0.field', $field);
        }
    }

    public function test_blade_renders_filtered_plaza_and_sealed_detail_in_the_initial_html(): void
    {
        config(['app.key' => 'base64:' . base64_encode(random_bytes(32))]);
        $u = $this->registerUser('blade@example.com', '静态首屏');
        $capsule = $this->createCapsule($u['accessToken'], ['title' => '首屏可见']);

        $plazaPath = '/?' . http_build_query(['q' => '首屏', 'filter' => 'unopened', 'sort' => 'hot']);
        $this->get($plazaPath)
            ->assertOk()
            ->assertSee('<h3><a href="/capsules/' . $capsule['code'] . '">首屏可见</a></h3>', false);

        $this->withHeader('Referer', url($plazaPath))
            ->get('/capsules/' . $capsule['code'])
            ->assertOk()
            ->assertSee('<h1>首屏可见</h1>', false)
            ->assertSee('filter=unopened')
            ->assertDontSee('寄给未来的信');
    }

    public function test_path_uuid_validation_returns_422(): void
    {
        $u = $this->registerUser('uuid@example.com', '路径校验');

        foreach (['not-a-uuid', '1-1-1-1-1', 'zzzzzzzz-0000-0000-0000-000000000000'] as $bad) {
            $this->getJson('/api/v1/plaza/capsules/' . $bad)
                ->assertStatus(422)
                ->assertJsonPath('errorCode', 'VALIDATION_ERROR');

            $this->withHeader('Authorization', 'Bearer ' . $u['accessToken'])
                ->deleteJson('/api/v1/me/capsules/' . $bad)
                ->assertStatus(422)
                ->assertJsonPath('errorCode', 'VALIDATION_ERROR');

            $this->withHeader('Authorization', 'Bearer ' . $u['accessToken'])
                ->deleteJson('/api/v1/me/favorites/' . $bad)
                ->assertStatus(422)
                ->assertJsonPath('errorCode', 'VALIDATION_ERROR');

            $this->withHeader('Authorization', 'Bearer ' . $u['accessToken'])
                ->postJson('/api/v1/me/favorites', ['capsuleId' => $bad])
                ->assertStatus(422)
                ->assertJsonPath('errorCode', 'VALIDATION_ERROR');
        }

        // 格式合法但不存在：plazaDetail / deleteCapsule → 404，取消收藏仍幂等 204
        $missing = '00000000-0000-0000-0000-000000000000';
        $this->getJson('/api/v1/plaza/capsules/' . $missing)->assertStatus(404);
        $this->withHeader('Authorization', 'Bearer ' . $u['accessToken'])
            ->deleteJson('/api/v1/me/capsules/' . $missing)->assertStatus(404);
        $this->withHeader('Authorization', 'Bearer ' . $u['accessToken'])
            ->deleteJson('/api/v1/me/favorites/' . $missing)->assertNoContent();
    }

    public function test_null_fields_are_explicitly_serialized_in_list_items(): void
    {
        $u = $this->registerUser('nulls@example.com', '空字段检查');
        $this->createCapsule($u['accessToken'], ['title' => '未开启空预览']);

        $item = $this->getJson('/api/v1/plaza/capsules')
            ->assertOk()
            ->json('data.items.0');

        $this->assertArrayHasKey('contentPreview', $item);
        $this->assertNull($item['contentPreview']);
        $this->assertArrayHasKey('favoritedAt', $item);
        $this->assertNull($item['favoritedAt']);
    }

    public function test_login_and_change_password_accept_2a_and_2b_bcrypt_hashes(): void
    {
        $u = $this->registerUser('cross-bcrypt@example.com', '跨栈密码测试', 'HelloTime2026!');
        $baseHash = (string) DB::table('users')->where('email', 'cross-bcrypt@example.com')->value('password_hash');

        foreach (['$2a$', '$2b$'] as $prefix) {
            $crossHash = $prefix . substr($baseHash, 4);
            DB::table('users')->where('email', 'cross-bcrypt@example.com')->update(['password_hash' => $crossHash]);

            $this->postJson('/api/v1/auth/login', [
                'email' => 'cross-bcrypt@example.com',
                'password' => 'HelloTime2026!',
            ])->assertOk()->assertJsonPath('success', true);

            $this->postJson('/api/v1/auth/login', [
                'email' => 'cross-bcrypt@example.com',
                'password' => 'WrongPass123!',
            ])->assertStatus(401)->assertJsonPath('errorCode', 'UNAUTHORIZED');
        }

        // $2a$ 哈希用户同样可以正常修改密码
        $this->withHeader('Authorization', 'Bearer ' . $u['accessToken'])
            ->postJson('/api/v1/me/password', [
                'currentPassword' => 'HelloTime2026!',
                'newPassword' => 'NewPass2026!',
            ])->assertNoContent();
    }
}
