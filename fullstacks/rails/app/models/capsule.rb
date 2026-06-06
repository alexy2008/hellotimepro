class Capsule < ApplicationRecord
  self.table_name = "capsules"
  self.primary_key = "id"

  cross_db_uuid :id, :owner_id
  cross_db_timestamp :open_at, :created_at, :updated_at
  # in_plaza 在 SQLite 是 INTEGER 0/1、在 PG 是 boolean——统一转 Ruby 布尔（0 在 Ruby 为真值，必须转）。
  attribute :in_plaza, :boolean

  before_create { self.id = SecureRandom.uuid if id.blank? }
end
