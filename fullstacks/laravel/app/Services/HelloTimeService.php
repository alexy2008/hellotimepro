<?php

namespace App\Services;

use App\Exceptions\ApiError;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Throwable;

class HelloTimeService
{
    private array $avatars = [];

    public function __construct()
    {
        $this->avatars = $this->loadAvatars();
    }

    public function health(): array
    {
        $sqlite = $this->driver() === 'sqlite';

        return [
            'status' => 'ok',
            'service' => 'hellotime-pro',
            'version' => '0.1.0',
            'uptimeSeconds' => max(0, time() - (int)($_SERVER['REQUEST_TIME'] ?? time())),
            'stack' => [
                'kind' => 'fullstack',
                'summary' => '基于 PHP 8 + Laravel 13 的服务端渲染全栈实现。Laravel 路由与控制器同时承载 /api/v1 JSON 契约和 Blade 页面；Blade 负责服务端渲染，Alpine.js 与少量原生脚本提供主题、菜单、AI 灵感、8 位码输入、收藏和资料页渐进增强。持久层使用 Laravel DB Query Builder 与事务，schema 由仓库级 scripts/db 按 spec/db 统一维护，运行时支持 PostgreSQL 与 SQLite 双驱动。SSR 会话使用 httpOnly cookie，API 仍兼容 Bearer token；浏览器 fetch 可通过 cookie 鉴权复用同一套 API 控制器。密码使用 Laravel Hash(bcrypt)，JWT HS256 与 refresh token 家族轮转/吊销在应用服务层实现。',
                'items' => [
                    ['role' => 'language', 'name' => 'PHP', 'version' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION, 'iconUrl' => '/static/icons/php.svg'],
                    ['role' => 'framework', 'name' => 'Laravel', 'version' => app()->version(), 'iconUrl' => '/static/icons/laravel.svg'],
                    ['role' => 'template', 'name' => 'Blade', 'version' => app()->version(), 'iconUrl' => '/static/icons/laravel.svg'],
                    ['role' => 'enhancement', 'name' => 'Alpine.js', 'version' => '3', 'iconUrl' => '/static/icons/javascript.svg'],
                    ['role' => 'database', 'name' => $sqlite ? 'SQLite' : 'PostgreSQL', 'version' => $sqlite ? '3' : '16', 'iconUrl' => '/static/icons/' . ($sqlite ? 'sqlite' : 'postgresql') . '.svg'],
                ],
            ],
        ];
    }

    public function avatars(): array
    {
        return $this->avatars;
    }

    public function register(array $body): array
    {
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        $nickname = trim((string)($body['nickname'] ?? ''));
        $avatar = (string)($body['avatarId'] ?? 'neo');
        $details = [];

        if (!$this->validEmail($email)) $details[] = ['field' => 'email', 'message' => '邮箱格式错误'];
        if (!$this->validPassword($password)) $details[] = ['field' => 'password', 'message' => '密码至少 8 位且包含字母和数字'];
        if (!$this->validNickname($nickname)) $details[] = ['field' => 'nickname', 'message' => '昵称长度需为 2-20，且仅包含中英文、数字、下划线或连字符'];
        if (!$this->validAvatar($avatar)) $details[] = ['field' => 'avatarId', 'message' => '头像不存在'];
        if ($details) throw new ApiError(422, 'VALIDATION_ERROR', '请求参数不合法', $details);

        if ($this->row('SELECT id FROM users WHERE email = ?', [$email])) {
            throw new ApiError(409, 'CONFLICT', '邮箱已存在');
        }
        if ($this->row('SELECT id FROM users WHERE nickname = ?', [$nickname])) {
            throw new ApiError(409, 'CONFLICT', '昵称已存在');
        }

        $id = $this->newId();
        $now = $this->nowDb();
        DB::insert(
            'INSERT INTO users (id,email,password_hash,nickname,avatar_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
            [$id, $email, Hash::make($password), $nickname, $avatar, $now, $now],
        );

        return $this->tokenPair($this->row('SELECT * FROM users WHERE id = ?', [$id]));
    }

    public function login(array $body): array
    {
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $key = $this->loginRateKey($email);
        if (RateLimiter::tooManyAttempts($key, 10)) {
            throw new ApiError(429, 'RATE_LIMITED', '登录失败过于频繁，请稍后再试');
        }

        $user = $this->row('SELECT * FROM users WHERE email = ?', [$email]);
        if (!$user || !Hash::check((string)($body['password'] ?? ''), $user['password_hash'])) {
            RateLimiter::hit($key, 60);
            throw new ApiError(401, 'UNAUTHORIZED', '邮箱或密码错误');
        }

        RateLimiter::clear($key);
        return $this->tokenPair($user);
    }

    public function refresh(string $refreshToken): array
    {
        if ($refreshToken === '') throw new ApiError(401, 'UNAUTHORIZED', 'refresh token 无效');
        $hash = hash('sha256', $refreshToken);

        $result = DB::transaction(function () use ($hash) {
            $row = $this->row(
                'SELECT rt.id AS refresh_id, rt.user_id, rt.token_hash, rt.family_id, rt.expires_at, rt.created_at, rt.revoked_at, u.email, u.nickname, u.avatar_id FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ?',
                [$hash],
            );
            if (!$row) return ['error' => [401, 'UNAUTHORIZED', 'refresh token 无效']];

            if (!empty($row['revoked_at'])) {
                DB::update('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE family_id = ?', [$this->nowDb(), $row['family_id']]);
                return ['error' => [401, 'UNAUTHORIZED', 'refresh token 已失效']];
            }

            if ($this->parseTime($row['expires_at'])->getTimestamp() < time()) {
                DB::update('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [$this->nowDb(), $row['refresh_id']]);
                return ['error' => [401, 'UNAUTHORIZED', 'refresh token 已过期']];
            }

            DB::update('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [$this->nowDb(), $row['refresh_id']]);
            return ['data' => $this->tokenPair($row, $row['family_id'])];
        });

        if (isset($result['error'])) {
            throw new ApiError(...$result['error']);
        }
        return $result['data'];
    }

    public function logout(string $refreshToken): void
    {
        if ($refreshToken !== '') {
            DB::update('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE token_hash = ?', [$this->nowDb(), hash('sha256', $refreshToken)]);
        }
    }

    public function currentUser(Request $request): ?array
    {
        $auth = $request->header('Authorization', '');
        $token = '';
        if ($auth !== '') {
            if (!str_starts_with($auth, 'Bearer ')) return null;
            $token = substr($auth, 7);
        } elseif ($request->cookies->has('ht_access')) {
            $token = (string)$request->cookies->get('ht_access');
        }

        if ($token === '') return null;
        $claims = $this->verifyJwt($token);
        if (!$claims || empty($claims['sub'])) return null;
        return $this->row('SELECT * FROM users WHERE id = ?', [$claims['sub']]);
    }

    public function requireUser(Request $request): array
    {
        $auth = $request->header('Authorization', '');
        if ($auth !== '' && !str_starts_with($auth, 'Bearer ')) {
            throw new ApiError(401, 'UNAUTHORIZED', '未认证');
        }
        $user = $this->currentUser($request);
        if (!$user) throw new ApiError(401, 'UNAUTHORIZED', '未认证');
        return $user;
    }

    public function userDto(array $user): array
    {
        return [
            'id' => $this->idOut($user['id']),
            'email' => $user['email'],
            'nickname' => $user['nickname'],
            'avatarId' => $user['avatar_id'],
            'createdAt' => $this->iso($user['created_at']),
        ];
    }

    public function updateProfile(array $user, array $body): array
    {
        $allowed = array_key_exists('nickname', $body) || array_key_exists('avatarId', $body);
        if (!$allowed) throw new ApiError(422, 'VALIDATION_ERROR', '至少提供 nickname 或 avatarId');

        $nickname = array_key_exists('nickname', $body) ? trim((string)$body['nickname']) : $user['nickname'];
        $avatar = array_key_exists('avatarId', $body) ? (string)$body['avatarId'] : $user['avatar_id'];
        if (!$this->validNickname($nickname)) throw new ApiError(422, 'VALIDATION_ERROR', '昵称长度需为 2-20');
        if (!$this->validAvatar($avatar)) throw new ApiError(422, 'VALIDATION_ERROR', '头像不存在');

        $conflict = $this->row('SELECT id FROM users WHERE nickname = ? AND id <> ?', [$nickname, $user['id']]);
        if ($conflict) throw new ApiError(409, 'CONFLICT', '昵称已存在');

        DB::update('UPDATE users SET nickname = ?, avatar_id = ?, updated_at = ? WHERE id = ?', [$nickname, $avatar, $this->nowDb(), $user['id']]);
        return $this->userDto($this->row('SELECT * FROM users WHERE id = ?', [$user['id']]));
    }

    public function changePassword(array $user, array $body): void
    {
        if (!Hash::check((string)($body['currentPassword'] ?? ''), $user['password_hash'])) {
            throw new ApiError(401, 'UNAUTHORIZED', '当前密码错误');
        }
        $next = (string)($body['newPassword'] ?? '');
        if (!$this->validPassword($next)) throw new ApiError(422, 'VALIDATION_ERROR', '新密码不符合要求');
        DB::update('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [Hash::make($next), $this->nowDb(), $user['id']]);
        DB::update('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE user_id = ?', [$this->nowDb(), $user['id']]);
    }

    public function createCapsule(array $user, array $body): array
    {
        $title = trim((string)($body['title'] ?? ''));
        $content = (string)($body['content'] ?? '');
        $openAtRaw = (string)($body['openAt'] ?? '');
        $inPlaza = !array_key_exists('inPlaza', $body) || filter_var($body['inPlaza'], FILTER_VALIDATE_BOOLEAN);
        $details = [];

        if ($title === '' || mb_strlen($title) > 60) $details[] = ['field' => 'title', 'message' => '标题长度需为 1-60'];
        if ($content === '' || mb_strlen($content) > 5000) $details[] = ['field' => 'content', 'message' => '内容长度需为 1-5000'];
        try { $openAt = new DateTimeImmutable($openAtRaw); } catch (Throwable) { $openAt = null; }
        if (!$openAt) $details[] = ['field' => 'openAt', 'message' => '开启时间格式错误'];
        if ($openAt) {
            $delta = $openAt->getTimestamp() - time();
            if ($delta <= 60) $details[] = ['field' => 'openAt', 'message' => '开启时间必须至少晚于当前 60 秒'];
            if ($delta > 10 * 365 * 86400) $details[] = ['field' => 'openAt', 'message' => '开启时间不能超过 10 年'];
        }
        if ($details) throw new ApiError(422, 'VALIDATION_ERROR', '请求参数不合法', $details);

        $id = $this->newId();
        $code = $this->uniqueCode();
        $now = $this->nowDb();
        DB::insert(
            'INSERT INTO capsules (id,owner_id,code,title,content,open_at,in_plaza,favorite_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$id, $user['id'], $code, $title, $content, $this->dbTimestamp($openAt), $this->boolParam($inPlaza), 0, $now, $now],
        );

        return $this->capsuleDetailById($id, $user['id']);
    }

    public function capsuleByCode(string $code, ?string $viewerId): array
    {
        $code = strtoupper($code);
        if (!preg_match('/^[A-Z0-9]{8}$/', $code)) throw new ApiError(422, 'VALIDATION_ERROR', '胶囊码格式错误');
        $row = $this->row('SELECT id FROM capsules WHERE code = ?', [$code]);
        if (!$row) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        return $this->capsuleDetailById($row['id'], $viewerId);
    }

    public function plazaDetail(string $id, ?string $viewerId): array
    {
        $canonical = $this->canonicalUuid($id);
        if ($canonical === null) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $dbId = $this->idToDb($canonical);
        $row = $this->row('SELECT id FROM capsules WHERE id = ? AND in_plaza = ?', [$dbId, $this->boolParam(true)]);
        if (!$row) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        return $this->capsuleDetailById($row['id'], $viewerId);
    }

    public function plazaList(?string $viewerId, array $query): array
    {
        $sort = (string)($query['sort'] ?? 'new');
        $filter = (string)($query['filter'] ?? 'all');
        $search = trim((string)($query['q'] ?? ''));
        if (!in_array($sort, ['new', 'hot'], true)) throw new ApiError(422, 'VALIDATION_ERROR', 'sort 仅支持 new/hot');
        if (!in_array($filter, ['all', 'opened', 'unopened'], true)) throw new ApiError(422, 'VALIDATION_ERROR', 'filter 仅支持 all/opened/unopened');
        if (mb_strlen($search) > 50) throw new ApiError(422, 'VALIDATION_ERROR', 'q 最多 50 字符');

        [$page, $size] = $this->pageParams($query, 20);
        $where = ['c.in_plaza = ?'];
        $params = [$this->boolParam(true)];
        $now = $this->nowDb();
        if ($filter === 'opened') { $where[] = 'c.open_at <= ?'; $params[] = $now; }
        if ($filter === 'unopened') { $where[] = 'c.open_at > ?'; $params[] = $now; }
        if ($search !== '') {
            $where[] = '(LOWER(c.title) LIKE ? OR LOWER(u.nickname) LIKE ?)';
            $params[] = '%' . mb_strtolower($search) . '%';
            $params[] = '%' . mb_strtolower($search) . '%';
        }

        $sqlWhere = implode(' AND ', $where);
        $total = (int)$this->row("SELECT COUNT(*) AS n FROM capsules c JOIN users u ON u.id = c.owner_id WHERE {$sqlWhere}", $params)['n'];
        $order = $sort === 'hot' ? 'c.favorite_count DESC, c.created_at DESC' : 'c.created_at DESC';
        $offset = ($page - 1) * $size;
        $rows = $this->rows("SELECT c.*, u.nickname, u.avatar_id FROM capsules c JOIN users u ON u.id = c.owner_id WHERE {$sqlWhere} ORDER BY {$order} LIMIT {$size} OFFSET {$offset}", $params);

        return ['items' => array_map(fn($r) => $this->listItem($r, $viewerId), $rows), 'pagination' => $this->pagination($page, $size, $total)];
    }

    public function myCapsules(array $user, array $query): array
    {
        [$page, $size] = $this->pageParams($query, 20);
        $total = (int)$this->row('SELECT COUNT(*) AS n FROM capsules WHERE owner_id = ?', [$user['id']])['n'];
        $offset = ($page - 1) * $size;
        $rows = $this->rows("SELECT c.*, u.nickname, u.avatar_id FROM capsules c JOIN users u ON u.id = c.owner_id WHERE c.owner_id = ? ORDER BY c.created_at DESC LIMIT {$size} OFFSET {$offset}", [$user['id']]);
        return ['items' => array_map(fn($r) => $this->listItem($r, $user['id']), $rows), 'pagination' => $this->pagination($page, $size, $total)];
    }

    public function myFavorites(array $user, array $query): array
    {
        [$page, $size] = $this->pageParams($query, 20);
        $total = (int)$this->row('SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?', [$user['id']])['n'];
        $offset = ($page - 1) * $size;
        $rows = $this->rows("SELECT c.*, u.nickname, u.avatar_id, f.created_at AS favorited_at FROM favorites f JOIN capsules c ON c.id = f.capsule_id JOIN users u ON u.id = c.owner_id WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT {$size} OFFSET {$offset}", [$user['id']]);
        return ['items' => array_map(fn($r) => $this->listItem($r, $user['id'], $r['favorited_at']), $rows), 'pagination' => $this->pagination($page, $size, $total)];
    }

    public function deleteCapsule(array $user, string $id): void
    {
        $canonical = $this->canonicalUuid($id);
        if ($canonical === null) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $dbId = $this->idToDb($canonical);
        $cap = $this->row('SELECT owner_id FROM capsules WHERE id = ?', [$dbId]);
        if (!$cap) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        if ($cap['owner_id'] !== $user['id']) throw new ApiError(403, 'FORBIDDEN', '不能删除他人的胶囊');
        DB::delete('DELETE FROM capsules WHERE id = ?', [$dbId]);
    }

    public function addFavorite(array $user, string $capsuleId): array
    {
        $canonical = $this->canonicalUuid($capsuleId);
        if ($canonical === null) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $dbId = $this->idToDb($canonical);

        return DB::transaction(function () use ($user, $canonical, $dbId) {
            $cap = DB::table('capsules')->where('id', $dbId)->where('in_plaza', $this->boolParam(true))->lockForUpdate()->first();
            $cap = $this->toArray($cap);
            if (!$cap) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
            if ($cap['owner_id'] === $user['id']) throw new ApiError(400, 'BAD_REQUEST', '不能收藏自己的胶囊');

            $existing = $this->row('SELECT created_at FROM favorites WHERE user_id = ? AND capsule_id = ?', [$user['id'], $dbId]);
            if ($existing) {
                return ['capsuleId' => $canonical, 'favoriteCount' => (int)$cap['favorite_count'], 'favoritedAt' => $this->iso($existing['created_at'])];
            }

            $now = $this->nowDb();
            DB::insert('INSERT INTO favorites (user_id,capsule_id,created_at) VALUES (?,?,?)', [$user['id'], $dbId, $now]);
            DB::update('UPDATE capsules SET favorite_count = favorite_count + 1, updated_at = ? WHERE id = ?', [$now, $dbId]);
            $count = (int)$this->row('SELECT favorite_count FROM capsules WHERE id = ?', [$dbId])['favorite_count'];
            return ['capsuleId' => $canonical, 'favoriteCount' => $count, 'favoritedAt' => $this->iso($now)];
        });
    }

    public function removeFavorite(array $user, string $capsuleId): void
    {
        // 取消收藏幂等：格式非法 / 胶囊不存在 / 原本未收藏都返回成功（204）。
        $canonical = $this->canonicalUuid($capsuleId);
        if ($canonical === null) return;
        $dbId = $this->idToDb($canonical);

        DB::transaction(function () use ($user, $dbId) {
            DB::table('capsules')->where('id', $dbId)->lockForUpdate()->first();
            $deleted = DB::delete('DELETE FROM favorites WHERE user_id = ? AND capsule_id = ?', [$user['id'], $dbId]);
            if ($deleted > 0) {
                $expr = $this->driver() === 'sqlite' ? 'MAX(favorite_count - 1, 0)' : 'GREATEST(favorite_count - 1, 0)';
                DB::update("UPDATE capsules SET favorite_count = {$expr}, updated_at = ? WHERE id = ? AND favorite_count > 0", [$this->nowDb(), $dbId]);
            }
        });
    }

    public function suggestion(array $body): array
    {
        $title = trim((string)($body['title'] ?? ''));
        if (mb_strlen($title) > 60) throw new ApiError(422, 'VALIDATION_ERROR', 'title 最多 60 字符');
        $autoTitle = $title === '';

        $generatedBy = 'local-template';
        $resultTitle = null;
        $content = null;
        $days = 0;
        $ok = false;

        try {
            $client = app(LlmClient::class);
            $node = $client->generateCapsuleSuggestion($this->buildSuggestionPrompt($title));
            $rawContent = trim((string)($node['content'] ?? ''));
            if (mb_strlen($rawContent) > 5000) $rawContent = mb_substr($rawContent, 0, 5000);
            if ($rawContent === '') throw new \RuntimeException('empty content');
            $rawDays = $this->coerceOpenInDays($node['openInDays'] ?? null);
            if ($autoTitle) {
                $genTitle = $this->truncateTitle((string)($node['title'] ?? ''));
                if ($genTitle === '') throw new \RuntimeException('empty title');
                $resultTitle = $genTitle;
            }
            $content = $rawContent;
            $days = $rawDays;
            $generatedBy = $client->provider() . ':' . $client->model();
            $ok = true;
        } catch (Throwable $e) {
            Log::warning('Capsule suggestion LLM failed; using local fallback: ' . $e->getMessage());
        }

        if (!$ok) {
            $fallback = $this->suggestionFallback($autoTitle, $title);
            $resultTitle = $autoTitle ? $fallback['title'] : null;
            $content = $fallback['content'];
            $days = $fallback['days'];
        }

        $openAt = (new DateTimeImmutable("+{$days} days", new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
        return [
            'title' => $resultTitle,
            'content' => $content,
            'openInDays' => $days,
            'openAt' => $openAt,
            'generatedBy' => $generatedBy,
            'cached' => false,
        ];
    }

    public function recommendations(array $query): array
    {
        $count = (int)($query['count'] ?? 4);
        if ($count < 3 || $count > 8) throw new ApiError(422, 'VALIDATION_ERROR', 'count 范围 3-8');

        $items = [];
        $generatedBy = 'none';
        try {
            $client = app(LlmClient::class);
            $node = $client->generateCapsuleRecommendations($this->buildRecommendationPrompt($count));
            $items = $this->parseRecommendationItems($node['items'] ?? null, $count);
            $generatedBy = $items === [] ? 'none' : $client->provider() . ':' . $client->model();
        } catch (Throwable $e) {
            // 锦上添花：LLM 不可用时返回空列表（不本地兜底、不报错）。
            Log::info('Capsule recommendations unavailable; returning empty list: ' . $e->getMessage());
        }

        return ['items' => $items, 'generatedBy' => $generatedBy, 'cached' => false];
    }

    private function buildSuggestionPrompt(string $title): string
    {
        $default = '你是中文写作助手。胶囊标题为 {TITLE_OR_EMPTY}（可能为空，为空时请先构思一个 1~18 字中文标题）。'
            . '为用户生成一段 260~400 字的时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。'
            . '只返回严格 JSON：{"title":"...","content":"...","openInDays":30}。';
        $template = $this->loadPrompt('capsule-suggestion.prompt.md', $default);
        return str_replace(['{TITLE_OR_EMPTY}', '{TITLE}'], $title, $template);
    }

    private function buildRecommendationPrompt(int $count): string
    {
        $default = '你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。'
            . '每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。'
            . '只返回严格 JSON：{"items":[{"title":"...","hint":"...","openInDays":30}]}。';
        $template = $this->loadPrompt('capsule-recommendation.prompt.md', $default);
        return str_replace('{COUNT}', (string)$count, $template);
    }

    private function loadPrompt(string $file, string $default): string
    {
        $path = $this->appRoot() . '/spec/llm/' . $file;
        $template = is_file($path) ? (string)file_get_contents($path) : '';
        return trim($template) === '' ? $default : $template;
    }

    private function coerceOpenInDays(mixed $value): int
    {
        if ($value === null) throw new \RuntimeException('openInDays missing');
        $n = is_int($value) ? $value : (is_numeric($value) ? (int)$value : null);
        if ($n === null) throw new \RuntimeException('openInDays not a number');
        return max(1, min(3650, $n));
    }

    private function truncateTitle(string $raw): string
    {
        $cleaned = trim(preg_replace('/[\r\n]+/', ' ', $raw));
        $cleaned = trim(preg_replace('/^[#*`　 "\'《》【】]+|[#*`　 "\'《》【】]+$/u', '', $cleaned));
        return mb_strlen($cleaned) > 60 ? mb_substr($cleaned, 0, 60) : $cleaned;
    }

    private function parseRecommendationItems(mixed $raw, int $limit): array
    {
        if (!is_array($raw)) return [];
        $items = [];
        $seen = [];
        foreach ($raw as $entry) {
            if (!is_array($entry)) continue;
            $title = $this->truncateText((string)($entry['title'] ?? ''), 60);
            $hint = $this->truncateText((string)($entry['hint'] ?? ''), 80);
            $days = is_numeric($entry['openInDays'] ?? null) ? max(1, min(3650, (int)$entry['openInDays'])) : null;
            if ($title === '' || $hint === '' || $days === null || isset($seen[$title])) continue;
            $seen[$title] = true;
            $items[] = ['title' => $title, 'hint' => $hint, 'openInDays' => $days];
            if (count($items) >= $limit) break;
        }
        return $items;
    }

    private function truncateText(string $raw, int $limit): string
    {
        $cleaned = trim(preg_replace('/[\r\n]+/', ' ', $raw));
        $cleaned = trim(preg_replace('/^[#*`　 "\'《》【】]+|[#*`　 "\'《》【】]+$/u', '', $cleaned));
        return mb_strlen($cleaned) > $limit ? mb_substr($cleaned, 0, $limit) : $cleaned;
    }

    private function suggestionFallback(bool $autoTitle, string $title): array
    {
        if ($autoTitle) {
            return self::FALLBACK_CAPSULES[array_rand(self::FALLBACK_CAPSULES)];
        }
        $days = [30, 90, 180, 365][array_rand([30, 90, 180, 365])];
        $content = "写下《{$title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。"
            . "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n"
            . "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、"
            . "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n"
            . "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。";
        return ['title' => $title, 'content' => $content, 'days' => $days];
    }

    private const FALLBACK_CAPSULES = [
        ['title' => '写给一个月后的自己', 'days' => 30,
            'content' => "此刻的我有点想对一个月后的你说说话。不知道那时的天气怎么样，你手边在忙些什么，有没有把现在挂在心上的那件小事做完。我想记住今天的样子：略显疲惫，却还愿意期待。\n\n如果这一个月过得顺利，那就好好奖励自己一次；如果有些计划落了空，也别太苛责，你已经在往前走了。记得多喝水，记得早点睡，记得偶尔抬头看看窗外。我们一个月后见。"],
        ['title' => '下个季度想完成的一件事', 'days' => 90,
            'content' => "我想把一件一直拖着的事认真做完，所以把它写进这封信里，让未来的你来检查。现在的我还在犹豫，担心做不好，担心时间不够；但比起完美，我更怕一直停在原地。\n\n等你读到这段话时，希望那件事已经有了眉目——哪怕只是迈出了第一步。无论结果如何，请记得为当初愿意开始的自己鼓一次掌。"],
        ['title' => '明年生日想对自己说的话', 'days' => 365,
            'content' => "又长了一岁的你，过得还好吗？我在今天提前为你写下这封信，想问问你有没有变成自己喜欢的样子。也许你完成了一些心愿，也许还有遗憾，但这都没关系。\n\n请记得今天的心情：对未来既忐忑又期待。生日快乐，愿你被爱，也愿你爱人。"],
        ['title' => '三年后还在做喜欢的事吗', 'days' => 1095,
            'content' => "三年说长不长，说短不短。我把现在最热爱的事写下来，想知道未来的你有没有把它坚持下去。此刻它带给我很多快乐，也带来一些迷茫。\n\n如果你还在做它，恭喜你守住了热爱；如果换了方向，也希望那是更适合你的选择。无论如何，别忘了当初让你眼睛发亮的那个瞬间。"],
        ['title' => '五年后的我在哪座城市', 'days' => 1825,
            'content' => "我常常好奇五年后会在哪里醒来：是熟悉的故乡，还是某个还没去过的城市？此刻的我对未来有许多想象，也有一点不安。\n\n等你打开这封信，请替现在的我看看窗外——那是我们一起走到的地方。不管落脚在哪，希望你过得踏实、自在。"],
    ];

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

    private function capsuleDetailById(string $id, ?string $viewerId): array
    {
        $row = $this->row('SELECT c.*, u.nickname, u.avatar_id FROM capsules c JOIN users u ON u.id = c.owner_id WHERE c.id = ?', [$id]);
        if (!$row) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $opened = $this->isOpened($row['open_at']);
        return [
            'id' => $this->idOut($row['id']),
            'code' => $row['code'],
            'title' => $row['title'],
            'content' => $opened ? $row['content'] : null,
            'creator' => ['id' => $this->idOut($row['owner_id']), 'nickname' => $row['nickname'], 'avatarId' => $row['avatar_id']],
            'openAt' => $this->iso($row['open_at']),
            'createdAt' => $this->iso($row['created_at']),
            'inPlaza' => $this->toBool($row['in_plaza']),
            'favoriteCount' => (int)$row['favorite_count'],
            'isOpened' => $opened,
            'favoritedByMe' => $viewerId ? $this->isFavorited($viewerId, $row['id']) : false,
        ];
    }

    private function listItem(array $row, ?string $viewerId, mixed $favoritedAt = null): array
    {
        $opened = $this->isOpened($row['open_at']);
        $item = [
            'id' => $this->idOut($row['id']),
            'code' => $row['code'],
            'title' => $row['title'],
            'creator' => ['id' => $this->idOut($row['owner_id']), 'nickname' => $row['nickname'], 'avatarId' => $row['avatar_id']],
            'openAt' => $this->iso($row['open_at']),
            'createdAt' => $this->iso($row['created_at']),
            'inPlaza' => $this->toBool($row['in_plaza']),
            'favoriteCount' => (int)$row['favorite_count'],
            'isOpened' => $opened,
            'favoritedByMe' => $viewerId ? $this->isFavorited($viewerId, $row['id']) : false,
        ];
        if ($opened) $item['contentPreview'] = mb_substr($row['content'], 0, 96);
        if ($favoritedAt) $item['favoritedAt'] = $this->iso($favoritedAt);
        return $item;
    }

    private function pageParams(array $query, int $defaultSize): array
    {
        $page = max(1, (int)($query['page'] ?? 1));
        $size = (int)($query['pageSize'] ?? $defaultSize);
        if ($size < 1 || $size > 50) throw new ApiError(422, 'VALIDATION_ERROR', 'pageSize 范围 1-50');
        return [$page, $size];
    }

    private function pagination(int $page, int $size, int $total): array
    {
        return ['page' => $page, 'pageSize' => $size, 'total' => $total, 'totalPages' => $size > 0 ? (int)ceil($total / $size) : 0];
    }

    private function isFavorited(string $userId, string $capsuleId): bool
    {
        return (bool)$this->row('SELECT 1 FROM favorites WHERE user_id = ? AND capsule_id = ?', [$userId, $capsuleId]);
    }

    private function tokenPair(array $user, ?string $familyId = null): array
    {
        $now = time();
        $expiresIn = 3600;
        $userId = $user['user_id'] ?? $user['id'];
        $accessPayload = [
            'sub' => $userId,
            'nickname' => $user['nickname'],
            'avatarId' => $user['avatar_id'],
            'iat' => $now,
            'exp' => $now + $expiresIn,
        ];
        $access = $this->jwt($accessPayload);
        $refresh = $this->base64url(random_bytes(32));
        $familyId = $familyId ?: $this->newId();
        DB::insert(
            'INSERT INTO refresh_tokens (id,user_id,token_hash,family_id,expires_at,created_at,revoked_at) VALUES (?,?,?,?,?,?,NULL)',
            [$this->newId(), $userId, hash('sha256', $refresh), $familyId, $this->dbTimestamp(new DateTimeImmutable('+7 days', new DateTimeZone('UTC'))), $this->nowDb()],
        );
        $fresh = $this->row('SELECT * FROM users WHERE id = ?', [$userId]);
        return [
            'accessToken' => $access,
            'refreshToken' => $refresh,
            'accessTokenExpiresIn' => $expiresIn,
            'user' => $this->userDto($fresh),
        ];
    }

    private function jwt(array $payload): string
    {
        $head = $this->base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
        $body = $this->base64url(json_encode($payload, JSON_UNESCAPED_SLASHES));
        $sig = $this->base64url(hash_hmac('sha256', "{$head}.{$body}", $this->jwtSecret(), true));
        return "{$head}.{$body}.{$sig}";
    }

    private function verifyJwt(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$head, $body, $sig] = $parts;
        $expected = $this->base64url(hash_hmac('sha256', "{$head}.{$body}", $this->jwtSecret(), true));
        if (!hash_equals($expected, $sig)) return null;
        $payload = json_decode($this->base64urlDecode($body), true);
        if (!is_array($payload) || (int)($payload['exp'] ?? 0) < time()) return null;
        return $payload;
    }

    private function uniqueCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $code = '';
            for ($i = 0; $i < 8; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            if (!$this->row('SELECT id FROM capsules WHERE code = ?', [$code])) return $code;
        }
        throw new ApiError(500, 'INTERNAL_ERROR', '胶囊码生成失败');
    }

    private function loadAvatars(): array
    {
        $root = $this->appRoot();
        $path = $root . '/spec/avatars/catalog.json';
        $json = is_file($path) ? json_decode(file_get_contents($path), true) : [];
        return $json['avatars'] ?? [];
    }

    private function row(string $sql, array $params = []): ?array
    {
        return $this->toArray(DB::selectOne($sql, $params));
    }

    private function rows(string $sql, array $params = []): array
    {
        return array_map(fn($row) => (array)$row, DB::select($sql, $params));
    }

    private function toArray(mixed $row): ?array
    {
        return $row ? (array)$row : null;
    }

    private function nowDb(): string
    {
        return $this->dbTimestamp(new DateTimeImmutable('now', new DateTimeZone('UTC')));
    }

    private function dbTimestamp(DateTimeImmutable $dt): string
    {
        $utc = $dt->setTimezone(new DateTimeZone('UTC'));
        if ($this->driver() === 'pgsql') {
            return $utc->format('Y-m-d H:i:s.vP');
        }
        // SQLite：与 spec/db seed 对齐——ISO-8601、T 分隔、+00:00，零小数不输出，
        // 靠字符串字典序支撑 open_at <= now / ORDER BY created_at，并与演示数据可比。
        $base = $utc->format('Y-m-d\TH:i:s');
        if ((int)$utc->format('u') > 0) {
            $base .= '.' . rtrim($utc->format('u'), '0');
        }
        return $base . '+00:00';
    }

    private function iso(mixed $value): string
    {
        return $this->parseTime($value)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }

    private function parseTime(mixed $value): DateTimeImmutable
    {
        return new DateTimeImmutable((string)$value, new DateTimeZone('UTC'));
    }

    private function isOpened(mixed $value): bool
    {
        return $this->parseTime($value) <= new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    private function toBool(mixed $value): bool
    {
        return $value === true || $value === 1 || $value === '1' || $value === 't' || $value === 'true';
    }

    private function boolParam(bool $value): mixed
    {
        return $this->driver() === 'sqlite' ? ($value ? 1 : 0) : ($value ? 'true' : 'false');
    }

    private function validEmail(string $email): bool
    {
        return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false && $email === strtolower($email);
    }

    private function validPassword(string $password): bool
    {
        return strlen($password) >= 8 && preg_match('/[A-Za-z]/', $password) && preg_match('/\d/', $password);
    }

    private function validNickname(string $nickname): bool
    {
        return preg_match('/^[\p{L}\p{N}_-]{2,20}$/u', $nickname) === 1;
    }

    private function validAvatar(string $avatar): bool
    {
        foreach ($this->avatars as $item) {
            if (($item['id'] ?? '') === $avatar) return true;
        }
        return false;
    }

    private function loginRateKey(string $email): string
    {
        return 'login:' . sha1($email);
    }

    /** 生成存储格式 id：SQLite 用 32 位无横线 hex（与 spec/db seed 对齐），Postgres 用标准带横线 UUID。 */
    private function newId(): string
    {
        $uuid = strtolower((string)Str::uuid());
        return $this->driver() === 'sqlite' ? str_replace('-', '', $uuid) : $uuid;
    }

    /** 校验并规范化客户端传入的 id（接受带横线或 32-hex），非法返回 null（调用方据此转 404，避免 PG uuid 类型 500）。 */
    private function canonicalUuid(string $value): ?string
    {
        $v = strtolower(trim($value));
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $v)) return $v;
        if (preg_match('/^[0-9a-f]{32}$/', $v)) return $this->dashify($v);
        return null;
    }

    private function dashify(string $hex): string
    {
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
    }

    /** 规范 UUID（带横线）→ 存储格式，用于 WHERE/INSERT 绑定。 */
    private function idToDb(string $canonical): string
    {
        return $this->driver() === 'sqlite' ? str_replace('-', '', $canonical) : $canonical;
    }

    /** 存储值 → 规范 UUID（带横线），用于 API 输出，保证两套驱动对外都是标准 UUID。 */
    private function idOut(mixed $value): string
    {
        $v = strtolower((string)$value);
        return (strlen($v) === 32 && ctype_xdigit($v)) ? $this->dashify($v) : $v;
    }

    private function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64urlDecode(string $data): string
    {
        return base64_decode(strtr($data . str_repeat('=', (4 - strlen($data) % 4) % 4), '-_', '+/')) ?: '';
    }

    private function jwtSecret(): string
    {
        return env('JWT_SECRET', env('APP_KEY', 'hellotime-laravel-dev-secret-0001'));
    }

    private function driver(): string
    {
        $driver = config('database.default');
        return $driver === 'pgsql' ? 'pgsql' : 'sqlite';
    }

    private function appRoot(): string
    {
        return env('APP_ROOT') ?: dirname(base_path(), 2);
    }
}
