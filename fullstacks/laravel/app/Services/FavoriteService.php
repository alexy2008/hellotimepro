<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Support\CrossDb;
use App\Support\Mapper;
use Illuminate\Support\Facades\DB;

/**
 * 收藏：添加（事务 + 行锁防 favorite_count 漂移、禁止收藏自己/未公开胶囊）、
 * 取消（幂等：非法/不存在/未收藏均按成功处理）、"我收藏的"列表。
 */
class FavoriteService
{
    public function __construct(
        private readonly CrossDb $db,
        private readonly Mapper $mapper,
    ) {
    }

    public function myFavorites(array $user, array $query): array
    {
        [$page, $size] = $this->mapper->pageParams($query);
        $total = (int) $this->db->row('SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?', [$user['id']])['n'];
        $offset = ($page - 1) * $size;
        $rows = $this->db->rows("SELECT c.*, u.nickname, u.avatar_id, f.created_at AS favorited_at FROM favorites f JOIN capsules c ON c.id = f.capsule_id JOIN users u ON u.id = c.owner_id WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT {$size} OFFSET {$offset}", [$user['id']]);
        return ['items' => array_map(fn ($r) => $this->mapper->listItem($r, $user['id'], $r['favorited_at']), $rows), 'pagination' => $this->mapper->pagination($page, $size, $total)];
    }

    public function addFavorite(array $user, string $capsuleId): array
    {
        $canonical = $this->db->canonicalUuid($capsuleId);
        if ($canonical === null) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $dbId = $this->db->idToDb($canonical);

        return DB::transaction(function () use ($user, $canonical, $dbId) {
            $cap = DB::table('capsules')->where('id', $dbId)->where('in_plaza', $this->db->boolParam(true))->lockForUpdate()->first();
            $cap = $this->db->toArray($cap);
            if (!$cap) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
            if ($cap['owner_id'] === $user['id']) throw new ApiError(400, 'BAD_REQUEST', '不能收藏自己的胶囊');

            $existing = $this->db->row('SELECT created_at FROM favorites WHERE user_id = ? AND capsule_id = ?', [$user['id'], $dbId]);
            if ($existing) {
                return ['capsuleId' => $canonical, 'favoriteCount' => (int) $cap['favorite_count'], 'favoritedAt' => $this->db->iso($existing['created_at'])];
            }

            $now = $this->db->nowDb();
            DB::insert('INSERT INTO favorites (user_id,capsule_id,created_at) VALUES (?,?,?)', [$user['id'], $dbId, $now]);
            DB::update('UPDATE capsules SET favorite_count = favorite_count + 1, updated_at = ? WHERE id = ?', [$now, $dbId]);
            $count = (int) $this->db->row('SELECT favorite_count FROM capsules WHERE id = ?', [$dbId])['favorite_count'];
            return ['capsuleId' => $canonical, 'favoriteCount' => $count, 'favoritedAt' => $this->db->iso($now)];
        });
    }

    public function removeFavorite(array $user, string $capsuleId): void
    {
        // 取消收藏幂等：格式非法 / 胶囊不存在 / 原本未收藏都返回成功（204）。
        $canonical = $this->db->canonicalUuid($capsuleId);
        if ($canonical === null) return;
        $dbId = $this->db->idToDb($canonical);

        DB::transaction(function () use ($user, $dbId) {
            DB::table('capsules')->where('id', $dbId)->lockForUpdate()->first();
            $deleted = DB::delete('DELETE FROM favorites WHERE user_id = ? AND capsule_id = ?', [$user['id'], $dbId]);
            if ($deleted > 0) {
                $expr = $this->db->isSqlite() ? 'MAX(favorite_count - 1, 0)' : 'GREATEST(favorite_count - 1, 0)';
                DB::update("UPDATE capsules SET favorite_count = {$expr}, updated_at = ? WHERE id = ? AND favorite_count > 0", [$this->db->nowDb(), $dbId]);
            }
        });
    }
}
