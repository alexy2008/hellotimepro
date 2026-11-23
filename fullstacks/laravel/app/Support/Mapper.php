<?php

namespace App\Support;

use App\Exceptions\ApiError;
use App\Models\Capsule;
use App\Models\Favorite;
use App\Models\User;
use DateTimeImmutable;

/**
 * 表现层映射：把 Eloquent 模型转换成 API/视图契约的 DTO 结构。集中所有对外字段命名与裁剪规则，
 * 保证各服务（capsule / plaza / favorite / auth）产出形状一致，空值字段照 OpenAPI 显式输出 null。
 */
class Mapper
{
    public function __construct(private readonly CrossDb $db)
    {
    }

    public function userDto(User $user): array
    {
        return [
            'id' => $this->db->idOut($user->id),
            'email' => $user->email,
            'nickname' => $user->nickname,
            'avatarId' => $user->avatar_id,
            'createdAt' => $this->db->iso($user->created_at),
        ];
    }

    /** 胶囊详情：已开启才返回完整 content，未开启显式返回 null。要求已 eager-load owner 关系。 */
    public function capsuleDetail(Capsule $c, ?string $viewerId): array
    {
        $opened = $this->db->isOpened($c->open_at);

        return [
            'id' => $this->db->idOut($c->id),
            'code' => $c->code,
            'title' => $c->title,
            'content' => $opened ? $c->content : null,
            'creator' => $this->creator($c),
            'openAt' => $this->db->iso($c->open_at),
            'createdAt' => $this->db->iso($c->created_at),
            'inPlaza' => (bool) $c->in_plaza,
            'favoriteCount' => (int) $c->favorite_count,
            'isOpened' => $opened,
            'favoritedByMe' => $viewerId !== null ? $this->isFavorited($viewerId, $c->id) : false,
        ];
    }

    /**
     * 列表项：已开启时附 contentPreview（前 80 字 + …，对齐 spec maxLength=81），
     * 未开启或无内容时显式返回 null；favoritedAt 无值时显式返回 null。
     *
     * @param  array<string, true>|null  $favoritedMap  预加载的已收藏胶囊原始 ID 集合，避免列表 N+1 查询
     */
    public function listItem(
        Capsule $c,
        ?string $viewerId,
        mixed $favoritedAt = null,
        ?array $favoritedMap = null,
        ?DateTimeImmutable $now = null,
    ): array {
        $opened = $this->db->isOpened($c->open_at, $now);
        $contentPreview = null;
        if ($opened) {
            $raw = trim((string) $c->content);
            if ($raw !== '') {
                $contentPreview = mb_strlen($raw, 'UTF-8') > 80 ? mb_substr($raw, 0, 80, 'UTF-8') . '…' : $raw;
            }
        }

        $favoritedByMe = $favoritedMap !== null
            ? isset($favoritedMap[(string) $c->id])
            : ($viewerId !== null ? $this->isFavorited($viewerId, (string) $c->id) : false);

        return [
            'id' => $this->db->idOut($c->id),
            'code' => $c->code,
            'title' => $c->title,
            'creator' => $this->creator($c),
            'openAt' => $this->db->iso($c->open_at),
            'createdAt' => $this->db->iso($c->created_at),
            'inPlaza' => (bool) $c->in_plaza,
            'favoriteCount' => (int) $c->favorite_count,
            'isOpened' => $opened,
            'favoritedByMe' => $favoritedByMe,
            'favoritedAt' => $favoritedAt ? $this->db->iso($favoritedAt) : null,
            'contentPreview' => $contentPreview,
        ];
    }

    /**
     * 批量查询某个用户已收藏的胶囊 ID 集合（key 为数据库原始主键字符串），用于消除列表 N+1。
     *
     * @param  array<int, string>  $capsuleIds
     * @return array<string, true>
     */
    public function favoritedIdMap(?string $viewerId, array $capsuleIds): array
    {
        if ($viewerId === null || $capsuleIds === []) {
            return [];
        }
        $rows = Favorite::query()
            ->where('user_id', $viewerId)
            ->whereIn('capsule_id', $capsuleIds)
            ->pluck('capsule_id')
            ->all();

        $map = [];
        foreach ($rows as $id) {
            $map[(string) $id] = true;
        }
        return $map;
    }

    public function creator(Capsule $c): array
    {
        return [
            'nickname' => $c->owner->nickname,
            'avatarId' => $c->owner->avatar_id,
        ];
    }

    public function pagination(int $page, int $size, int $total): array
    {
        return [
            'page' => $page,
            'pageSize' => $size,
            'total' => $total,
            'totalPages' => $size > 0 ? (int) ceil($total / $size) : 0,
        ];
    }

    /** 解析并校验分页查询参数；page < 1 或 pageSize 越界 → 422。 */
    public function pageParams(array $query, int $defaultSize = 20): array
    {
        $rawPage = $query['page'] ?? 1;
        $rawSize = $query['pageSize'] ?? $defaultSize;
        if (!is_numeric($rawPage) || (int) $rawPage < 1) {
            throw new ApiError(422, 'VALIDATION_ERROR', 'page 必须 >= 1', [['field' => 'page', 'message' => 'page 必须 >= 1']]);
        }
        if (!is_numeric($rawSize) || (int) $rawSize < 1 || (int) $rawSize > 50) {
            throw new ApiError(422, 'VALIDATION_ERROR', 'pageSize 范围 1-50', [['field' => 'pageSize', 'message' => 'pageSize 范围 1-50']]);
        }
        return [(int) $rawPage, (int) $rawSize];
    }

    public function isFavorited(string $userId, string $capsuleId): bool
    {
        return Favorite::query()
            ->where('user_id', $userId)
            ->where('capsule_id', $capsuleId)
            ->exists();
    }
}
