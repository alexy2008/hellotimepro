class Favorite < ApplicationRecord
  self.table_name = "favorites"
  self.primary_key = [:user_id, :capsule_id]

  cross_db_uuid :user_id, :capsule_id
  cross_db_timestamp :created_at
end
