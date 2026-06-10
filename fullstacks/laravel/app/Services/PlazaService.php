<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Models\Capsule;
use App\Support\CrossDb;
use App\Support\Mapper;
use Illuminate\Database\Eloquent\Builder;

/**
 * 胶囊广场：公开列表（排序 new/hot、过滤 all/opened/unopened、按标题或昵称搜索）与公开详情。
 * 仅 in_plaza = true 的胶囊对外可见。数据访问走 Eloquent 查询构建器。
 */
class PlazaService
{
    public function __construct(
        private readonly CrossDb $db,
        private readonly Mapper $mapper,
    ) {
    }

    public function plazaList(?string $viewerId, array $query): array
    {
        $sort = (string) ($query['sort'] ?? 'new');
        $filter = (string) ($query['filter'] ?? 'all');
        $search = trim((string) ($query['q'] ?? ''));
        if (!in_array($sort, ['new', 'hot'], true)) throw new ApiError(422, 'VALIDATION_ERROR', 'sort 仅支持 new/hot');
        if (!in_array($filter, ['all', 'opened', 'unopened'], true)) throw new ApiError(422, 'VALIDATION_ERROR', 'filter 仅支持 all/opened/unopened');
        if (mb_strlen($search) > 50) throw new ApiError(422, 'VALIDATION_ERROR', 'q 最多 50 字符');

        [$page, $size] = $this->mapper->pageParams($query);
        $now = $this->db->nowDb();

        // has('owner') 复刻原 INNER JOIN users 语义：owner 已被级联删除的孤儿胶囊不计入广场。
        $base = Capsule::query()->has('owner')->where('in_plaza', $this->db->boolParam(true));
        if ($filter === 'opened') $base->where('open_at', '<=', $now);
        if ($filter === 'unopened') $base->where('open_at', '>', $now);
        if ($search !== '') {
            // 转义 LIKE 元字符（\、%、_），防止用户输入被解读为通配符；标题 OR 作者昵称。
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($search));
            $like = '%' . $escaped . '%';
            $base->where(function (Builder $w) use ($like) {
                $w->whereRaw("LOWER(capsules.title) LIKE ? ESCAPE '\\'", [$like])
                    ->orWhereHas('owner', fn (Builder $o) => $o->whereRaw("LOWER(nickname) LIKE ? ESCAPE '\\'", [$like]));
            });
        }

        $total = (clone $base)->count();

        $base->with('owner');
        $sort === 'hot'
            ? $base->orderByDesc('favorite_count')->orderByDesc('created_at')
            : $base->orderByDesc('created_at');
        $rows = $base->forPage($page, $size)->get();

        return [
            'items' => $rows->map(fn (Capsule $c) => $this->mapper->listItem($c, $viewerId))->all(),
            'pagination' => $this->mapper->pagination($page, $size, $total),
        ];
    }

    public function plazaDetail(string $id, ?string $viewerId): array
    {
        $canonical = $this->db->canonicalUuid($id);
        if ($canonical === null) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $capsule = Capsule::with('owner')
            ->has('owner')
            ->where('id', $this->db->idToDb($canonical))
            ->where('in_plaza', $this->db->boolParam(true))
            ->first();
        if (!$capsule) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');

        return $this->mapper->capsuleDetail($capsule, $viewerId);
    }
}
