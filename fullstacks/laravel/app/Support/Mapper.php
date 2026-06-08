<?php

namespace App\Support;

use App\Exceptions\ApiError;

/**
 * 表现层映射：把数据库行转换成 API/视图契约的 DTO 结构。集中所有对外字段命名与裁剪规则，
 * 保证各服务（capsule / plaza / favorite / auth）产出形状一致。
 */
class Mapper
{
    public function __construct(private readonly CrossDb $db)
    {
    }

    /** 按存储 id 读取胶囊详情并映射；不存在 → 404。capsule/plaza 两个服务共用。 */
    public function capsuleDetailById(string $id, ?string $viewerId): array
    {
        $row = $this->db->row('SELECT c.*, u.nickname, u.avatar_id FROM capsules c JOIN users u ON u.id = c.owner_id WHERE c.id = ?', [$id]);
        if (!$row) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        return $this->capsuleDetail($row, $viewerId);
    }

    public function userDto(array $user): array
    {
        return [
            'id' => $this->db->idOut($user['id']),
            'email' => $user['email'],
            'nickname' => $user['nickname'],
            'avatarId' => $user['avatar_id'],
            'createdAt' => $this->db->iso($user['created_at']),
        ];
    }

    /** 胶囊详情：已开启才返回完整 content。 */
    public function capsuleDetail(array $row, ?string $viewerId): array
    {
        $opened = $this->db->isOpened($row['open_at']);
        return [
            'id' => $this->db->idOut($row['id']),
            'code' => $row['code'],
            'title' => $row['title'],
            'content' => $opened ? $row['content'] : null,
            'creator' => $this->creator($row),
            'openAt' => $this->db->iso($row['open_at']),
            'createdAt' => $this->db->iso($row['created_at']),
            'inPlaza' => $this->db->toBool($row['in_plaza']),
            'favoriteCount' => (int) $row['favorite_count'],
            'isOpened' => $opened,
            'favoritedByMe' => $viewerId ? $this->isFavorited($viewerId, $row['id']) : false,
        ];
    }

    /** 列表项：已开启时附 contentPreview（前 80 字 + …，对齐 spec maxLength=81）。 */
    public function listItem(array $row, ?string $viewerId, mixed $favoritedAt = null): array
    {
        $opened = $this->db->isOpened($row['open_at']);
        $item = [
            'id' => $this->db->idOut($row['id']),
            'code' => $row['code'],
            'title' => $row['title'],
            'creator' => $this->creator($row),
            'openAt' => $this->db->iso($row['open_at']),
            'createdAt' => $this->db->iso($row['created_at']),
            'inPlaza' => $this->db->toBool($row['in_plaza']),
            'favoriteCount' => (int) $row['favorite_count'],
            'isOpened' => $opened,
            'favoritedByMe' => $viewerId ? $this->isFavorited($viewerId, $row['id']) : false,
        ];
        if ($opened) {
            $raw = $row['content'];
            $item['contentPreview'] = mb_strlen($raw) > 80 ? mb_substr($raw, 0, 80) . '…' : $raw;
        }
        if ($favoritedAt) {
            $item['favoritedAt'] = $this->db->iso($favoritedAt);
        }
        return $item;
    }

    public function creator(array $row): array
    {
        return ['id' => $this->db->idOut($row['owner_id']), 'nickname' => $row['nickname'], 'avatarId' => $row['avatar_id']];
    }

    public function pagination(int $page, int $size, int $total): array
    {
        return ['page' => $page, 'pageSize' => $size, 'total' => $total, 'totalPages' => $size > 0 ? (int) ceil($total / $size) : 0];
    }

    /** 解析并校验分页查询参数；pageSize 越界 → 422。三个列表端点共用。 */
    public function pageParams(array $query, int $defaultSize = 20): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        $size = (int) ($query['pageSize'] ?? $defaultSize);
        if ($size < 1 || $size > 50) throw new ApiError(422, 'VALIDATION_ERROR', 'pageSize 范围 1-50');
        return [$page, $size];
    }

    public function isFavorited(string $userId, string $capsuleId): bool
    {
        return (bool) $this->db->row('SELECT 1 FROM favorites WHERE user_id = ? AND capsule_id = ?', [$userId, $capsuleId]);
    }
}
