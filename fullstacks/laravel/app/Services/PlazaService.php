<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Models\Capsule;
use App\Support\CrossDb;
use App\Support\Mapper;
use Illuminate\Database\Eloquent\Builder;

/**
 * 胶囊广场（2.0）：公开列表、广场统计（plazaStats，counts 与列表同口径、farthest/next 不受 q 影响）与公开详情。
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
        $search = $this->normalizeQuery($query['q'] ?? null);

        if (!in_array($sort, ['new', 'hot'], true)) {
            throw new ApiError(422, 'VALIDATION_ERROR', 'sort 仅支持 new/hot', [['field' => 'sort', 'message' => 'sort 仅支持 new/hot']]);
        }
        if (!in_array($filter, ['all', 'opened', 'unopened'], true)) {
            throw new ApiError(422, 'VALIDATION_ERROR', 'filter 仅支持 all/opened/unopened', [['field' => 'filter', 'message' => 'filter 仅支持 all/opened/unopened']]);
        }

        [$page, $size] = $this->mapper->pageParams($query);
        $nowUtc = $this->db->nowUtc();
        $now = $this->db->dbTimestamp($nowUtc);

        $base = $this->basePlazaQuery($search);
        if ($filter === 'opened') {
            $base->where('open_at', '<=', $now);
        } elseif ($filter === 'unopened') {
            $base->where('open_at', '>', $now);
        }

        $total = (clone $base)->count();

        $base->with('owner');
        if ($sort === 'hot') {
            $base->orderByDesc('favorite_count')->orderByDesc('created_at');
        } else {
            $base->orderByDesc('created_at');
        }
        $rows = $base->forPage($page, $size)->get();

        $faved = $this->mapper->favoritedIdMap($viewerId, $rows->pluck('id')->all());

        return [
            'items' => $rows->map(fn (Capsule $c) => $this->mapper->listItem($c, $viewerId, null, $faved, $nowUtc))->all(),
            'pagination' => $this->mapper->pagination($page, $size, $total),
        ];
    }

    /**
     * 广场统计（2.0 新增）：
     * - counts 与列表共用同一套 where（in_plaza = true + q），确保与三种 filter 下 total 严格一致；
     * - farthestOpenAt / nextOpenAt 不受 q 影响，用 ORDER BY open_at ... LIMIT 1 取列避免聚合丢失类型；
     * - 空集时 counts 全部返回 0，两个时刻返回 null。
     */
    public function plazaStats(array $query): array
    {
        $search = $this->normalizeQuery($query['q'] ?? null);
        $now = $this->db->nowDb();

        $row = $this->basePlazaQuery($search)
            ->selectRaw(
                'COUNT(*) AS all_cnt, '
                . 'COALESCE(SUM(CASE WHEN open_at <= ? THEN 1 ELSE 0 END), 0) AS opened_cnt, '
                . 'COALESCE(SUM(CASE WHEN open_at > ? THEN 1 ELSE 0 END), 0) AS unopened_cnt',
                [$now, $now],
            )
            ->first();

        $all = (int) ($row->all_cnt ?? 0);
        $opened = (int) ($row->opened_cnt ?? 0);
        $unopened = (int) ($row->unopened_cnt ?? 0);

        $farthest = Capsule::query()
            ->has('owner')
            ->where('in_plaza', $this->db->boolParam(true))
            ->orderByDesc('open_at')
            ->limit(1)
            ->value('open_at');

        $next = Capsule::query()
            ->has('owner')
            ->where('in_plaza', $this->db->boolParam(true))
            ->where('open_at', '>', $now)
            ->orderBy('open_at')
            ->limit(1)
            ->value('open_at');

        return [
            'counts' => [
                'all' => $all,
                'opened' => $opened,
                'unopened' => $unopened,
            ],
            'farthestOpenAt' => $farthest !== null ? $this->db->iso($farthest) : null,
            'nextOpenAt' => $next !== null ? $this->db->iso($next) : null,
        ];
    }

    public function plazaDetail(string $id, ?string $viewerId): array
    {
        $canonical = $this->db->canonicalUuid($id);
        if ($canonical === null) {
            throw new ApiError(422, 'VALIDATION_ERROR', '胶囊 ID 格式错误', [['field' => 'id', 'message' => '胶囊 ID 不是合法的 UUID']]);
        }
        $capsule = Capsule::with('owner')
            ->has('owner')
            ->whereIn('id', $this->db->idCandidates($canonical))
            ->where('in_plaza', $this->db->boolParam(true))
            ->first();
        if (!$capsule) {
            throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        }

        return $this->mapper->capsuleDetail($capsule, $viewerId);
    }

    private function normalizeQuery(mixed $raw): string
    {
        $search = trim((string) ($raw ?? ''));
        if (mb_strlen($search, 'UTF-8') > 50) {
            throw new ApiError(422, 'VALIDATION_ERROR', 'q 最多 50 字符', [['field' => 'q', 'message' => 'q 长度不得超过 50']]);
        }
        return $search;
    }

    /** 广场列表与广场统计共享的基础过滤条件（has('owner') + in_plaza = true + 字面子串搜索 q）。 */
    private function basePlazaQuery(string $search): Builder
    {
        $base = Capsule::query()->has('owner')->where('in_plaza', $this->db->boolParam(true));
        if ($search !== '') {
            // 字面子串匹配：先转义 \、%、_，再加 ESCAPE '\'，避免用户输入被解读为通配符
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($search, 'UTF-8'));
            $like = '%' . $escaped . '%';
            $base->where(function (Builder $w) use ($like) {
                $w->whereRaw("LOWER(capsules.title) LIKE ? ESCAPE '\\'", [$like])
                    ->orWhereHas('owner', fn (Builder $o) => $o->whereRaw("LOWER(nickname) LIKE ? ESCAPE '\\'", [$like]));
            });
        }
        return $base;
    }
}
