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
 * 收藏（2.0）：
 * - 不再校验胶囊状态：自己的、inPlaza = false 的、未开启 / 已开启的胶囊均可收藏，只校验 UUID 格式（422）与胶囊存在（404）；
 * - 重复收藏幂等（200）；取消收藏非法 UUID → 422，格式合法但不存在 / 未收藏幂等返回 204；
 * - 事务加锁顺序统一为「胶囊 → 收藏」（PG 下 FOR UPDATE 只锁 capsules 表，不连 users），与删除胶囊一致，避免并发死锁。
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
        $nowUtc = $this->db->nowUtc();

        $base = Favorite::query()
            ->where('user_id', $user->id)
            ->whereHas('capsule', fn ($q) => $q->has('owner'));

        $total = (clone $base)->count();

        $favorites = $base->with('capsule.owner')
            ->orderByDesc('created_at')
            ->forPage($page, $size)
            ->get();

        $favedMap = [];
        foreach ($favorites as $f) {
            if ($f->capsule !== null) {
                $favedMap[(string) $f->capsule->id] = true;
            }
        }

        $items = $favorites
            ->filter(fn (Favorite $f) => $f->capsule !== null && $f->capsule->owner !== null)
            ->map(fn (Favorite $f) => $this->mapper->listItem($f->capsule, $user->id, $f->created_at, $favedMap, $nowUtc))
            ->values()
            ->all();

        return [
            'items' => $items,
            'pagination' => $this->mapper->pagination($page, $size, $total),
        ];
    }

    public function addFavorite(User $user, string $capsuleId): array
    {
        $canonical = $this->db->canonicalUuid($capsuleId);
        if ($canonical === null) {
            throw new ApiError(422, 'VALIDATION_ERROR', '胶囊 ID 格式错误', [['field' => 'capsuleId', 'message' => 'capsuleId 不是合法的 UUID']]);
        }
        $candidates = $this->db->idCandidates($canonical);

        return DB::transaction(function () use ($user, $candidates): array {
            $query = Capsule::query()->whereIn('id', $candidates);
            if (!$this->db->isSqlite()) {
                $query->lockForUpdate();
            }
            $cap = $query->first();
            if (!$cap) {
                throw new ApiError(404, 'NOT_FOUND', '胶囊不存在');
            }

            $existing = Favorite::query()
                ->where('user_id', $user->id)
                ->where('capsule_id', $cap->id)
                ->first();
            if ($existing) {
                return [
                    'capsuleId' => $this->db->idOut($cap->id),
                    'favoriteCount' => (int) $cap->favorite_count,
                    'favoritedAt' => $this->db->iso($existing->created_at),
                ];
            }

            $now = $this->db->nowDb();
            Favorite::create([
                'user_id' => $user->id,
                'capsule_id' => $cap->id,
                'created_at' => $now,
            ]);
            $cap->increment('favorite_count', 1, ['updated_at' => $now]);

            return [
                'capsuleId' => $this->db->idOut($cap->id),
                'favoriteCount' => (int) $cap->favorite_count,
                'favoritedAt' => $this->db->iso($now),
            ];
        });
    }

    public function removeFavorite(User $user, string $capsuleId): void
    {
        $canonical = $this->db->canonicalUuid($capsuleId);
        if ($canonical === null) {
            throw new ApiError(422, 'VALIDATION_ERROR', '胶囊 ID 格式错误', [['field' => 'capsuleId', 'message' => 'capsuleId 不是合法的 UUID']]);
        }
        $candidates = $this->db->idCandidates($canonical);

        DB::transaction(function () use ($user, $candidates): void {
            $query = Capsule::query()->whereIn('id', $candidates);
            if (!$this->db->isSqlite()) {
                $query->lockForUpdate();
            }
            $cap = $query->first();
            if (!$cap) {
                return;
            }
            $deleted = Favorite::query()
                ->where('user_id', $user->id)
                ->where('capsule_id', $cap->id)
                ->delete();
            if ($deleted > 0) {
                Capsule::query()
                    ->where('id', $cap->id)
                    ->where('favorite_count', '>', 0)
                    ->decrement('favorite_count', 1, ['updated_at' => $this->db->nowDb()]);
            }
        });
    }
}
