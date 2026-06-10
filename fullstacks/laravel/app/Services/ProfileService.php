<?php

namespace App\Services;

use App\Exceptions\ApiError;
use App\Models\User;
use App\Support\CrossDb;
use App\Support\Mapper;
use App\Support\Validation;

/**
 * 账号资料：读取自身 DTO 与更新昵称/头像（昵称唯一性冲突 → 409）。数据访问走 Eloquent。
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

    public function userDto(User $user): array
    {
        return $this->mapper->userDto($user);
    }

    public function updateProfile(User $user, array $body): array
    {
        $allowed = array_key_exists('nickname', $body) || array_key_exists('avatarId', $body);
        if (!$allowed) throw new ApiError(422, 'VALIDATION_ERROR', '至少提供 nickname 或 avatarId');

        $nickname = array_key_exists('nickname', $body) ? trim((string) $body['nickname']) : $user->nickname;
        $avatar = array_key_exists('avatarId', $body) ? (string) $body['avatarId'] : $user->avatar_id;
        if (!$this->validate->nickname($nickname)) throw new ApiError(422, 'VALIDATION_ERROR', '昵称长度需为 2-20');
        if (!$this->avatars->valid($avatar)) throw new ApiError(422, 'VALIDATION_ERROR', '头像不存在');

        $conflict = User::where('nickname', $nickname)->where('id', '!=', $user->id)->exists();
        if ($conflict) throw new ApiError(409, 'CONFLICT', '昵称已存在');

        $user->nickname = $nickname;
        $user->avatar_id = $avatar;
        $user->updated_at = $this->db->nowDb();
        $user->save();

        return $this->mapper->userDto($user);
    }
}
