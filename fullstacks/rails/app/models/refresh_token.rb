class RefreshToken < ApplicationRecord
  self.table_name = "refresh_tokens"
  self.primary_key = "id"

  cross_db_uuid :id, :user_id, :family_id
  cross_db_timestamp :expires_at, :created_at, :revoked_at

  before_create { self.id = SecureRandom.uuid if id.blank? }
end
