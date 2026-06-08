<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Support\CrossDb;
use App\Support\Mapper;
use App\Support\Validation;
use Illuminate\Support\Facades\DB;

/**
 * 账号资料：读取自身 DTO 与更新昵称/头像（昵称唯一性冲突 → 409）。
 */
class ProfileService
{
    public function __construct(
        private readonly CrossDb $db,
        private readonly Validation $validate,
        private readonly AvatarCatalog $avatars,
        private readonly Mapper $mapper,
    ) {
    }

    public function userDto(array $user): array
    {
        return $this->mapper->userDto($user);
    }

    public function updateProfile(array $user, array $body): array
    {
        $allowed = array_key_exists('nickname', $body) || array_key_exists('avatarId', $body);
        if (!$allowed) throw new ApiError(422, 'VALIDATION_ERROR', '至少提供 nickname 或 avatarId');

        $nickname = array_key_exists('nickname', $body) ? trim((string) $body['nickname']) : $user['nickname'];
        $avatar = array_key_exists('avatarId', $body) ? (string) $body['avatarId'] : $user['avatar_id'];
        if (!$this->validate->nickname($nickname)) throw new ApiError(422, 'VALIDATION_ERROR', '昵称长度需为 2-20');
        if (!$this->avatars->valid($avatar)) throw new ApiError(422, 'VALIDATION_ERROR', '头像不存在');

        $conflict = $this->db->row('SELECT id FROM users WHERE nickname = ? AND id <> ?', [$nickname, $user['id']]);
        if ($conflict) throw new ApiError(409, 'CONFLICT', '昵称已存在');

        DB::update('UPDATE users SET nickname = ?, avatar_id = ?, updated_at = ? WHERE id = ?', [$nickname, $avatar, $this->db->nowDb(), $user['id']]);
        return $this->mapper->userDto($this->db->row('SELECT * FROM users WHERE id = ?', [$user['id']]));
    }
}
