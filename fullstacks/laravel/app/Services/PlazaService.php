<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Support\CrossDb;
use App\Support\Mapper;

/**
 * 胶囊广场：公开列表（排序 new/hot、过滤 all/opened/unopened、按标题或昵称搜索）与公开详情。
 * 仅 in_plaza = true 的胶囊对外可见。
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
        $where = ['c.in_plaza = ?'];
        $params = [$this->db->boolParam(true)];
        $now = $this->db->nowDb();
        if ($filter === 'opened') { $where[] = 'c.open_at <= ?'; $params[] = $now; }
        if ($filter === 'unopened') { $where[] = 'c.open_at > ?'; $params[] = $now; }
        if ($search !== '') {
            // 转义 LIKE 元字符（\、%、_），防止用户输入被解读为通配符
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($search));
            $where[] = '(LOWER(c.title) LIKE ? ESCAPE \'\\\' OR LOWER(u.nickname) LIKE ? ESCAPE \'\\\')';
            $params[] = '%' . $escaped . '%';
            $params[] = '%' . $escaped . '%';
        }

        $sqlWhere = implode(' AND ', $where);
        $total = (int) $this->db->row("SELECT COUNT(*) AS n FROM capsules c JOIN users u ON u.id = c.owner_id WHERE {$sqlWhere}", $params)['n'];
        $order = $sort === 'hot' ? 'c.favorite_count DESC, c.created_at DESC' : 'c.created_at DESC';
        $offset = ($page - 1) * $size;
        $rows = $this->db->rows("SELECT c.*, u.nickname, u.avatar_id FROM capsules c JOIN users u ON u.id = c.owner_id WHERE {$sqlWhere} ORDER BY {$order} LIMIT {$size} OFFSET {$offset}", $params);

        return ['items' => array_map(fn ($r) => $this->mapper->listItem($r, $viewerId), $rows), 'pagination' => $this->mapper->pagination($page, $size, $total)];
    }

    public function plazaDetail(string $id, ?string $viewerId): array
    {
        $canonical = $this->db->canonicalUuid($id);
        if ($canonical === null) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $dbId = $this->db->idToDb($canonical);
        $row = $this->db->row('SELECT id FROM capsules WHERE id = ? AND in_plaza = ?', [$dbId, $this->db->boolParam(true)]);
        if (!$row) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        return $this->mapper->capsuleDetailById($row['id'], $viewerId);
    }
}
