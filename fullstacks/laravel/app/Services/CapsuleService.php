<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Models\Capsule;
use App\Models\User;
use App\Support\CrossDb;
use App\Support\Mapper;
use DateTimeImmutable;
use Throwable;

/**
 * 胶囊生命周期：创建（含校验 + 唯一码）、按胶囊码查看、删除（所有者校验）、"我创建的"列表。
 * 内容与开启时间一经创建即不可变（符合设计约束）。数据访问全部走 Eloquent。
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
        $openAtRaw = (string) ($body['openAt'] ?? '');
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

        $now = $this->db->nowDb();
        $capsule = Capsule::create([
            'owner_id' => $user->id,
            'code' => $this->uniqueCode(),
            'title' => $title,
            'content' => $content,
            'open_at' => $this->db->dbTimestamp($openAt),
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
        if (!preg_match('/^[A-Z0-9]{8}$/', $code)) throw new ApiError(422, 'VALIDATION_ERROR', '胶囊码格式错误');
        // has('owner') 复刻原 INNER JOIN users 语义：owner 缺失的孤儿胶囊视作不存在。
        $capsule = Capsule::with('owner')->has('owner')->where('code', $code)->first();
        if (!$capsule) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');

        return $this->mapper->capsuleDetail($capsule, $viewerId);
    }

    public function myCapsules(User $user, array $query): array
    {
        [$page, $size] = $this->mapper->pageParams($query);
        $total = Capsule::where('owner_id', $user->id)->count();
        $rows = Capsule::with('owner')
            ->has('owner')
            ->where('owner_id', $user->id)
            ->orderByDesc('created_at')
            ->forPage($page, $size)
            ->get();

        return [
            'items' => $rows->map(fn (Capsule $c) => $this->mapper->listItem($c, $user->id))->all(),
            'pagination' => $this->mapper->pagination($page, $size, $total),
        ];
    }

    public function deleteCapsule(User $user, string $id): void
    {
        $canonical = $this->db->canonicalUuid($id);
        if ($canonical === null) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $capsule = Capsule::find($this->db->idToDb($canonical));
        if (!$capsule) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        if ($capsule->owner_id !== $user->id) throw new ApiError(403, 'FORBIDDEN', '不能删除他人的胶囊');
        $capsule->delete();
    }

    private function uniqueCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $code = '';
            for ($i = 0; $i < 8; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            if (!Capsule::where('code', $code)->exists()) return $code;
        }
        throw new ApiError(500, 'INTERNAL_ERROR', '胶囊码生成失败');
    }
}
