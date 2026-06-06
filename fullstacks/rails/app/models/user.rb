class User < ApplicationRecord
  self.table_name = "users"
  self.primary_key = "id"

  cross_db_uuid :id
  cross_db_timestamp :created_at, :updated_at

  before_create { self.id = SecureRandom.uuid if id.blank? }
end
