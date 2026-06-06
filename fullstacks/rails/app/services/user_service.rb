module UserService
  module_function

  def to_dto(user)
    MapperService.user(user)
  end

  def update_profile(user, params)
    if params[:nickname].nil? && params[:avatarId].nil?
      raise ApiError.validation("至少提供一个字段", "body")
    end

    new_nickname = params[:nickname].nil? ? nil : Validation.nickname(params[:nickname])
    new_avatar = params[:avatarId].nil? ? nil : Validation.avatar_format(params[:avatarId])

    ActiveRecord::Base.transaction do
      if new_nickname && new_nickname != user.nickname
        raise ApiError.conflict("昵称已被使用", "nickname") if User.exists?(nickname: new_nickname)

        user.nickname = new_nickname
      end
      if new_avatar
        raise ApiError.validation("头像 ID 不存在", "avatarId") unless AvatarService.exists?(new_avatar)

        user.avatar_id = new_avatar
      end
      user.updated_at = Time.now.utc
      user.save!
    end
    MapperService.user(user)
  end
end
