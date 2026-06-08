<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Support\CrossDb;
use App\Support\JwtCodec;
use App\Support\Mapper;
use App\Support\Validation;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

/**
 * 认证与会话：注册、登录（含失败限流）、refresh token 家族轮转/吊销、登出、
 * 当前用户解析（Bearer 或 httpOnly cookie 双通道）、改密（吊销全部 refresh token）。
 */
class AuthService
{
    private const ACCESS_TTL = 3600;            // 1 小时
    private const REFRESH_TTL = 7 * 24 * 3600;  // 7 天
    private const LOGIN_MAX_ATTEMPTS = 10;      // 锁定阈值：窗口内连续失败次数
    private const LOGIN_DECAY = 900;            // 失败计数窗口（秒）。15 分钟而非 60 秒：
                                                // 既是更合理的暴力破解防护，也让计数不受单请求时延影响而稳定累积。

    public function __construct(
        private readonly CrossDb $db,
        private readonly Validation $validate,
        private readonly AvatarCatalog $avatars,
        private readonly JwtCodec $jwt,
        private readonly Mapper $mapper,
    ) {
    }

    public function register(array $body): array
    {
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $nickname = trim((string) ($body['nickname'] ?? ''));
        $avatar = (string) ($body['avatarId'] ?? 'neo');
        $details = [];

        if (!$this->validate->email($email)) $details[] = ['field' => 'email', 'message' => '邮箱格式错误'];
        if (!$this->validate->password($password)) $details[] = ['field' => 'password', 'message' => '密码至少 8 位且包含字母和数字'];
        if (!$this->validate->nickname($nickname)) $details[] = ['field' => 'nickname', 'message' => '昵称长度需为 2-20，且仅包含中英文、数字、下划线或连字符'];
        if (!$this->avatars->valid($avatar)) $details[] = ['field' => 'avatarId', 'message' => '头像不存在'];
        if ($details) throw new ApiError(422, 'VALIDATION_ERROR', '请求参数不合法', $details);

        if ($this->db->row('SELECT id FROM users WHERE email = ?', [$email])) {
            throw new ApiError(409, 'CONFLICT', '邮箱已存在');
        }
        if ($this->db->row('SELECT id FROM users WHERE nickname = ?', [$nickname])) {
            throw new ApiError(409, 'CONFLICT', '昵称已存在');
        }

        $id = $this->db->newId();
        $now = $this->db->nowDb();
        DB::insert(
            'INSERT INTO users (id,email,password_hash,nickname,avatar_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
            [$id, $email, Hash::make($password), $nickname, $avatar, $now, $now],
        );

        return $this->tokenPair($this->db->row('SELECT * FROM users WHERE id = ?', [$id]));
    }

    public function login(array $body): array
    {
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $key = $this->loginRateKey($email);
        if (RateLimiter::tooManyAttempts($key, self::LOGIN_MAX_ATTEMPTS)) {
            throw new ApiError(429, 'RATE_LIMITED', '登录失败过于频繁，请稍后再试');
        }

        $user = $this->db->row('SELECT * FROM users WHERE email = ?', [$email]);
        if (!$user || !Hash::check((string) ($body['password'] ?? ''), $user['password_hash'])) {
            RateLimiter::hit($key, self::LOGIN_DECAY);
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
            $row = $this->db->row(
                'SELECT rt.id AS refresh_id, rt.user_id, rt.token_hash, rt.family_id, rt.expires_at, rt.created_at, rt.revoked_at, u.email, u.nickname, u.avatar_id FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ?',
                [$hash],
            );
            if (!$row) return ['error' => [401, 'UNAUTHORIZED', 'refresh token 无效']];

            if (!empty($row['revoked_at'])) {
                // 复用已吊销的 token：判定为家族泄露，吊销整族。
                DB::update('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE family_id = ?', [$this->db->nowDb(), $row['family_id']]);
                return ['error' => [401, 'UNAUTHORIZED', 'refresh token 已失效']];
            }

            if ($this->db->parseTime($row['expires_at'])->getTimestamp() < time()) {
                DB::update('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [$this->db->nowDb(), $row['refresh_id']]);
                return ['error' => [401, 'UNAUTHORIZED', 'refresh token 已过期']];
            }

            DB::update('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [$this->db->nowDb(), $row['refresh_id']]);
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
            DB::update('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE token_hash = ?', [$this->db->nowDb(), hash('sha256', $refreshToken)]);
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
            $token = (string) $request->cookies->get('ht_access');
        }

        if ($token === '') return null;
        $claims = $this->jwt->decode($token);
        if (!$claims || empty($claims['sub'])) return null;
        return $this->db->row('SELECT * FROM users WHERE id = ?', [$claims['sub']]);
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

    public function changePassword(array $user, array $body): void
    {
        if (!Hash::check((string) ($body['currentPassword'] ?? ''), $user['password_hash'])) {
            throw new ApiError(401, 'UNAUTHORIZED', '当前密码错误');
        }
        $next = (string) ($body['newPassword'] ?? '');
        if (!$this->validate->password($next)) throw new ApiError(422, 'VALIDATION_ERROR', '新密码不符合要求');
        DB::update('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [Hash::make($next), $this->db->nowDb(), $user['id']]);
        DB::update('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE user_id = ?', [$this->db->nowDb(), $user['id']]);
    }

    /** 签发 access + refresh token 对；familyId 非空表示沿用同一家族（轮转）。 */
    private function tokenPair(array $user, ?string $familyId = null): array
    {
        $now = time();
        $userId = $user['user_id'] ?? $user['id'];
        $access = $this->jwt->encode([
            'sub' => $userId,
            'nickname' => $user['nickname'],
            'avatarId' => $user['avatar_id'],
            'iat' => $now,
            'exp' => $now + self::ACCESS_TTL,
        ]);
        $refresh = $this->jwt->base64url(random_bytes(32));
        $familyId = $familyId ?: $this->db->newId();
        DB::insert(
            'INSERT INTO refresh_tokens (id,user_id,token_hash,family_id,expires_at,created_at,revoked_at) VALUES (?,?,?,?,?,?,NULL)',
            [$this->db->newId(), $userId, hash('sha256', $refresh), $familyId, $this->db->dbTimestamp(new DateTimeImmutable('+7 days', new DateTimeZone('UTC'))), $this->db->nowDb()],
        );
        $fresh = $this->db->row('SELECT * FROM users WHERE id = ?', [$userId]);
        return [
            'accessToken' => $access,
            'refreshToken' => $refresh,
            'accessTokenExpiresIn' => self::ACCESS_TTL,
            'refreshTokenExpiresIn' => self::REFRESH_TTL,
            'user' => $this->mapper->userDto($fresh),
        ];
    }

    private function loginRateKey(string $email): string
    {
        return 'login:' . sha1($email);
    }
}
