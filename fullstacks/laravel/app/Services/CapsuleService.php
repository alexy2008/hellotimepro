<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Models\Capsule;
use App\Models\Favorite;
use App\Models\User;
use App\Support\CrossDb;
use App\Support\Mapper;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * 胶囊生命周期（2.0）：创建（10 个日历年上限 + 唯一码）、按码查询、"我创建的"列表、
 * 我的统计（myStats）与删除（事务内 PG 先锁胶囊行再显式删收藏再删胶囊）。
 */
class CapsuleService
{
    public function __construct(
        private readonly CrossDb $db,
        private readonly Mapper $mapper,
    ) {
    }

    public function createCapsule(User $user, array $body): array
    {
        $title = trim((string) ($body['title'] ?? ''));
        $content = (string) ($body['content'] ?? '');
        $openAtRaw = trim((string) ($body['openAt'] ?? ''));
        $inPlaza = !array_key_exists('inPlaza', $body) || filter_var($body['inPlaza'], FILTER_VALIDATE_BOOLEAN);
        $details = [];

        $titleLen = mb_strlen($title, 'UTF-8');
        $contentLen = mb_strlen($content, 'UTF-8');
        if ($titleLen < 1 || $titleLen > 60) {
            $details[] = ['field' => 'title', 'message' => '标题长度需为 1-60'];
        }
        if ($contentLen < 1 || $contentLen > 5000) {
            $details[] = ['field' => 'content', 'message' => '内容长度需为 1-5000'];
        }

        $openAtUtc = null;
        if ($openAtRaw !== '') {
            try {
                $openAtUtc = (new DateTimeImmutable($openAtRaw, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('UTC'));
            } catch (Throwable) {
                $openAtUtc = null;
            }
        }

        if ($openAtUtc === null) {
            $details[] = ['field' => 'openAt', 'message' => '开启时间格式错误'];
        } else {
            $nowUtc = $this->db->nowUtc();
            $minOpenAt = $nowUtc->modify('+60 seconds');
            $maxOpenAt = $this->db->addCalendarYears($nowUtc, 10);
            if ($openAtUtc <= $minOpenAt) {
                $details[] = ['field' => 'openAt', 'message' => '开启时间必须至少晚于当前 60 秒'];
            }
            if ($openAtUtc > $maxOpenAt) {
                $details[] = ['field' => 'openAt', 'message' => '开启时间不能超过 10 个日历年'];
            }
        }

        if ($details) {
            throw new ApiError(422, 'VALIDATION_ERROR', '请求参数不合法', $details);
        }

        $now = $this->db->nowDb();
        $capsule = Capsule::create([
            'owner_id' => $user->id,
            'code' => $this->uniqueCode(),
            'title' => $title,
            'content' => $content,
            'open_at' => $this->db->dbTimestamp($openAtUtc),
            'in_plaza' => $inPlaza,
            'favorite_count' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $capsule->load('owner');

        return $this->mapper->capsuleDetail($capsule, $user->id);
    }

    public function capsuleByCode(string $code, ?string $viewerId): array
    {
        $code = strtoupper($code);
        if (!preg_match('/^[A-Z0-9]{8}$/', $code)) {
            throw new ApiError(422, 'VALIDATION_ERROR', '胶囊码格式错误', [['field' => 'code', 'message' => '胶囊码必须是 8 位字母与数字']]);
        }
        $capsule = Capsule::with('owner')->has('owner')->where('code', $code)->first();
        if (!$capsule) {
            throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        }

        return $this->mapper->capsuleDetail($capsule, $viewerId);
    }

    public function myCapsules(User $user, array $query): array
    {
        [$page, $size] = $this->mapper->pageParams($query);
        $nowUtc = $this->db->nowUtc();
        $total = Capsule::where('owner_id', $user->id)->count();
        $rows = Capsule::with('owner')
            ->has('owner')
            ->where('owner_id', $user->id)
            ->orderByDesc('created_at')
            ->forPage($page, $size)
            ->get();

        // 2.0 起可以收藏自己的胶囊，favoritedByMe 照常批量计算
        $faved = $this->mapper->favoritedIdMap($user->id, $rows->pluck('id')->all());

        return [
            'items' => $rows->map(fn (Capsule $c) => $this->mapper->listItem($c, $user->id, null, $faved, $nowUtc))->all(),
            'pagination' => $this->mapper->pagination($page, $size, $total),
        ];
    }

    /**
     * 我的统计（2.0 新增）：包含未公开的胶囊；空集全部返回 0。
     */
    public function myStats(User $user): array
    {
        $now = $this->db->nowDb();
        $trueParam = $this->db->boolParam(true);

        $row = Capsule::query()
            ->where('owner_id', $user->id)
            ->selectRaw(
                'COUNT(*) AS created_cnt, '
                . 'COALESCE(SUM(CASE WHEN open_at <= ? THEN 1 ELSE 0 END), 0) AS opened_cnt, '
                . 'COALESCE(SUM(CASE WHEN open_at > ? THEN 1 ELSE 0 END), 0) AS unopened_cnt, '
                . 'COALESCE(SUM(CASE WHEN in_plaza = ? THEN 1 ELSE 0 END), 0) AS in_plaza_cnt, '
                . 'COALESCE(SUM(favorite_count), 0) AS fav_received',
                [$now, $now, $trueParam],
            )
            ->first();

        $given = Favorite::query()
            ->where('user_id', $user->id)
            ->whereHas('capsule', fn ($q) => $q->has('owner'))
            ->count();

        return [
            'created' => (int) ($row->created_cnt ?? 0),
            'opened' => (int) ($row->opened_cnt ?? 0),
            'unopened' => (int) ($row->unopened_cnt ?? 0),
            'inPlaza' => (int) ($row->in_plaza_cnt ?? 0),
            'favoritesReceived' => (int) ($row->fav_received ?? 0),
            'favoritesGiven' => (int) $given,
        ];
    }

    /**
     * 删除自己的胶囊：
     * - 校验路径 UUID 格式（非法 → 422）
     * - 同一事务内：PG 先 SELECT ... FOR UPDATE 锁胶囊行（不连 users 表），与收藏/取消收藏保持相同加锁顺序防死锁
     * - 显式先删 favorites 再删 capsule，不依赖外键级联（SQLite 未开 foreign_keys 时照样生效）
     */
    public function deleteCapsule(User $user, string $id): void
    {
        $canonical = $this->db->canonicalUuid($id);
        if ($canonical === null) {
            throw new ApiError(422, 'VALIDATION_ERROR', '胶囊 ID 格式错误', [['field' => 'id', 'message' => '胶囊 ID 不是合法的 UUID']]);
        }

        $candidates = $this->db->idCandidates($canonical);

        DB::transaction(function () use ($user, $candidates): void {
            $query = Capsule::query()->whereIn('id', $candidates);
            if (!$this->db->isSqlite()) {
                $query->lockForUpdate();
            }
            $capsule = $query->first();
            if (!$capsule) {
                throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
            }
            if ($capsule->owner_id !== $user->id) {
                throw new ApiError(403, 'FORBIDDEN', '不能删除他人的胶囊');
            }

            Favorite::query()->where('capsule_id', $capsule->id)->delete();
            $capsule->delete();
        });
    }

    private function uniqueCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $code = '';
            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            if (!Capsule::where('code', $code)->exists()) {
                return $code;
            }
        }
        throw new ApiError(500, 'INTERNAL_ERROR', '胶囊码生成失败');
    }
}
