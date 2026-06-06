module CapsuleService
  module_function

  CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".chars.freeze

  def create(owner, params)
    title = Validation.title(params[:title])
    content = Validation.content(params[:content])
    open_at = Validation.open_at(params[:openAt])
    now = Time.now.utc
    raise ApiError.validation("openAt 必须晚于当前时间 60 秒以上", "openAt") if open_at < now + 60
    raise ApiError.validation("openAt 不得超出当前时间 10 年", "openAt") if open_at > now + (10 * 365 * 24 * 3600)

    in_plaza = params[:inPlaza].nil? ? true : !!params[:inPlaza]

    capsule = Capsule.create!(
      owner_id: owner.id,
      code: generate_unique_code,
      title: title,
      content: content,
      open_at: open_at,
      in_plaza: in_plaza,
      favorite_count: 0,
    )
    MapperService.detail(capsule, owner, favorited_by_me: false, include_content: true)
  end

  def get_by_code(code, viewer_id)
    Validation.code(code)
    capsule = Capsule.find_by(code: code.upcase)
    raise ApiError.not_found("胶囊不存在") if capsule.nil?

    owner = User.find_by(id: capsule.owner_id) or raise ApiError.not_found("胶囊不存在")
    favorited = !viewer_id.nil? && Favorite.exists?(user_id: viewer_id, capsule_id: capsule.id)
    MapperService.detail(capsule, owner, favorited_by_me: favorited, include_content: true)
  end

  def get_plaza_detail(id_raw, viewer_id)
    id = CrossDb.parse_uuid_or_nil(id_raw) or raise ApiError.not_found("胶囊不存在")
    capsule = Capsule.find_by(id: id)
    raise ApiError.not_found("胶囊不存在") if capsule.nil? || !capsule.in_plaza

    owner = User.find_by(id: capsule.owner_id) or raise ApiError.not_found("胶囊不存在")
    favorited = !viewer_id.nil? && Favorite.exists?(user_id: viewer_id, capsule_id: capsule.id)
    MapperService.detail(capsule, owner, favorited_by_me: favorited, include_content: true)
  end

  def delete_own(user, id_raw)
    id = CrossDb.parse_uuid_or_nil(id_raw) or raise ApiError.not_found("胶囊不存在")
    ActiveRecord::Base.transaction do
      capsule = Capsule.find_by(id: id) or raise ApiError.not_found("胶囊不存在")
      raise ApiError.forbidden("无权删除他人胶囊") if capsule.owner_id != user.id

      Favorite.where(capsule_id: id).delete_all
      capsule.destroy!
    end
  end

  def generate_unique_code
    5.times do
      candidate = Array.new(8) { CODE_ALPHABET.sample }.join
      return candidate unless Capsule.exists?(code: candidate)
    end
    raise "生成唯一码失败"
  end
end
