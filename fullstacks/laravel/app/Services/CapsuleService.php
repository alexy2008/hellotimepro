<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Support\CrossDb;
use App\Support\Mapper;
use DateTimeImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * 胶囊生命周期：创建（含校验 + 唯一码）、按胶囊码查看、删除（所有者校验）、"我创建的"列表。
 * 内容与开启时间一经创建即不可变（符合设计约束）。
 */
class CapsuleService
{
    public function __construct(
        private readonly CrossDb $db,
        private readonly Mapper $mapper,
    ) {
    }

    public function createCapsule(array $user, array $body): array
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

        $id = $this->db->newId();
        $code = $this->uniqueCode();
        $now = $this->db->nowDb();
        DB::insert(
            'INSERT INTO capsules (id,owner_id,code,title,content,open_at,in_plaza,favorite_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$id, $user['id'], $code, $title, $content, $this->db->dbTimestamp($openAt), $this->db->boolParam($inPlaza), 0, $now, $now],
        );

        return $this->mapper->capsuleDetailById($id, $user['id']);
    }

    public function capsuleByCode(string $code, ?string $viewerId): array
    {
        $code = strtoupper($code);
        if (!preg_match('/^[A-Z0-9]{8}$/', $code)) throw new ApiError(422, 'VALIDATION_ERROR', '胶囊码格式错误');
        $row = $this->db->row('SELECT id FROM capsules WHERE code = ?', [$code]);
        if (!$row) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        return $this->mapper->capsuleDetailById($row['id'], $viewerId);
    }

    public function myCapsules(array $user, array $query): array
    {
        [$page, $size] = $this->mapper->pageParams($query);
        $total = (int) $this->db->row('SELECT COUNT(*) AS n FROM capsules WHERE owner_id = ?', [$user['id']])['n'];
        $offset = ($page - 1) * $size;
        $rows = $this->db->rows("SELECT c.*, u.nickname, u.avatar_id FROM capsules c JOIN users u ON u.id = c.owner_id WHERE c.owner_id = ? ORDER BY c.created_at DESC LIMIT {$size} OFFSET {$offset}", [$user['id']]);
        return ['items' => array_map(fn ($r) => $this->mapper->listItem($r, $user['id']), $rows), 'pagination' => $this->mapper->pagination($page, $size, $total)];
    }

    public function deleteCapsule(array $user, string $id): void
    {
        $canonical = $this->db->canonicalUuid($id);
        if ($canonical === null) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $dbId = $this->db->idToDb($canonical);
        $cap = $this->db->row('SELECT owner_id FROM capsules WHERE id = ?', [$dbId]);
        if (!$cap) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        if ($cap['owner_id'] !== $user['id']) throw new ApiError(403, 'FORBIDDEN', '不能删除他人的胶囊');
        DB::delete('DELETE FROM capsules WHERE id = ?', [$dbId]);
    }

    private function uniqueCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $code = '';
            for ($i = 0; $i < 8; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            if (!$this->db->row('SELECT id FROM capsules WHERE code = ?', [$code])) return $code;
        }
        throw new ApiError(500, 'INTERNAL_ERROR', '胶囊码生成失败');
    }
}
