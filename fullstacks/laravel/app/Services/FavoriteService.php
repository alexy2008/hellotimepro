<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Models\Capsule;
use App\Models\Favorite;
use App\Models\User;
use App\Support\CrossDb;
use App\Support\Mapper;
use Illuminate\Support\Facades\DB;

/**
 * 收藏：添加（事务 + 行锁防 favorite_count 漂移、禁止收藏自己/未公开胶囊）、
 * 取消（幂等：非法/不存在/未收藏均按成功处理）、"我收藏的"列表。数据访问走 Eloquent。
 */
class FavoriteService
{
    public function __construct(
        private readonly CrossDb $db,
        private readonly Mapper $mapper,
    ) {
    }

    public function myFavorites(User $user, array $query): array
    {
        [$page, $size] = $this->mapper->pageParams($query);
        $total = Favorite::where('user_id', $user->id)->count();
        $favorites = Favorite::with('capsule.owner')
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->forPage($page, $size)
            ->get();

        $items = $favorites
            // 复刻原 INNER JOIN capsules/users 语义：胶囊或其 owner 缺失的收藏行被排除。
            ->filter(fn (Favorite $f) => $f->capsule !== null && $f->capsule->owner !== null)
            ->map(fn (Favorite $f) => $this->mapper->listItem($f->capsule, $user->id, $f->created_at))
            ->values()
            ->all();

        return ['items' => $items, 'pagination' => $this->mapper->pagination($page, $size, $total)];
    }

    public function addFavorite(User $user, string $capsuleId): array
    {
        $canonical = $this->db->canonicalUuid($capsuleId);
        if ($canonical === null) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
        $dbId = $this->db->idToDb($canonical);

        return DB::transaction(function () use ($user, $canonical, $dbId) {
            // 行锁住胶囊，序列化对 favorite_count 的并发更新。
            $cap = Capsule::where('id', $dbId)
                ->where('in_plaza', $this->db->boolParam(true))
                ->lockForUpdate()
                ->first();
            if (!$cap) throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
            if ($cap->owner_id === $user->id) throw new ApiError(400, 'BAD_REQUEST', '不能收藏自己的胶囊');

            $existing = Favorite::where('user_id', $user->id)->where('capsule_id', $dbId)->first();
            if ($existing) {
                return ['capsuleId' => $canonical, 'favoriteCount' => (int) $cap->favorite_count, 'favoritedAt' => $this->db->iso($existing->created_at)];
            }

            $now = $this->db->nowDb();
            Favorite::create(['user_id' => $user->id, 'capsule_id' => $dbId, 'created_at' => $now]);
            $cap->increment('favorite_count', 1, ['updated_at' => $now]);

            return ['capsuleId' => $canonical, 'favoriteCount' => (int) $cap->favorite_count, 'favoritedAt' => $this->db->iso($now)];
        });
    }

    public function removeFavorite(User $user, string $capsuleId): void
    {
        // 取消收藏幂等：格式非法 / 胶囊不存在 / 原本未收藏都返回成功（204）。
        $canonical = $this->db->canonicalUuid($capsuleId);
        if ($canonical === null) return;
        $dbId = $this->db->idToDb($canonical);

        DB::transaction(function () use ($user, $dbId) {
            Capsule::where('id', $dbId)->lockForUpdate()->first();
            $deleted = Favorite::where('user_id', $user->id)->where('capsule_id', $dbId)->delete();
            if ($deleted > 0) {
                // WHERE favorite_count > 0 即把计数下限钳在 0（只在 >0 时才减 1）。
                Capsule::where('id', $dbId)
                    ->where('favorite_count', '>', 0)
                    ->decrement('favorite_count', 1, ['updated_at' => $this->db->nowDb()]);
            }
        });
    }
}
