<?php

namespace App\Support;

use App\Exceptions\ApiError;
use App\Models\Capsule;
use App\Models\Favorite;
use App\Models\User;

/**
 * 表现层映射：把 Eloquent 模型转换成 API/视图契约的 DTO 结构。集中所有对外字段命名与裁剪规则，
 * 保证各服务（capsule / plaza / favorite / auth）产出形状一致。
 *
 * id 与时间戳在模型里保持存储格式（id 不做 Eloquent cast——否则关系 join/WHERE 会用错值），
 * 这里统一转成对外契约：id → 标准带横线 UUID、时间戳 → ISO-8601 `…Z`。
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

    /** 胶囊详情：已开启才返回完整 content。要求已 eager-load owner 关系。 */
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
            'favoritedByMe' => $viewerId ? $this->isFavorited($viewerId, $c->id) : false,
        ];
    }

    /** 列表项：已开启时附 contentPreview（前 80 字 + …，对齐 spec maxLength=81）。 */
    public function listItem(Capsule $c, ?string $viewerId, mixed $favoritedAt = null): array
    {
        $opened = $this->db->isOpened($c->open_at);
        $item = [
            'id' => $this->db->idOut($c->id),
            'code' => $c->code,
            'title' => $c->title,
            'creator' => $this->creator($c),
            'openAt' => $this->db->iso($c->open_at),
            'createdAt' => $this->db->iso($c->created_at),
            'inPlaza' => (bool) $c->in_plaza,
            'favoriteCount' => (int) $c->favorite_count,
            'isOpened' => $opened,
            'favoritedByMe' => $viewerId ? $this->isFavorited($viewerId, $c->id) : false,
        ];
        if ($opened) {
            $raw = (string) $c->content;
            $item['contentPreview'] = mb_strlen($raw) > 80 ? mb_substr($raw, 0, 80) . '…' : $raw;
        }
        if ($favoritedAt) {
            $item['favoritedAt'] = $this->db->iso($favoritedAt);
        }

        return $item;
    }

    public function creator(Capsule $c): array
    {
        return [
            'id' => $this->db->idOut($c->owner_id),
            'nickname' => $c->owner->nickname,
            'avatarId' => $c->owner->avatar_id,
        ];
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
        return Favorite::query()
            ->where('user_id', $userId)
            ->where('capsule_id', $capsuleId)
            ->exists();
    }
}
