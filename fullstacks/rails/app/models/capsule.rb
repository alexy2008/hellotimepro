class Capsule < ApplicationRecord
  self.table_name = "capsules"
  self.primary_key = "id"
  belongs_to :owner, class_name: "User"

  scope :published, -> { where(in_plaza: true) }
  scope :opened_by, ->(time) { where(open_at_column.lteq(CrossDb.time_bound(time))) }
  scope :opening_after, ->(time) { where(open_at_column.gt(CrossDb.time_bound(time))) }

  def self.open_at_column = CrossDb.time_column("capsules.open_at")
  def self.created_at_column = CrossDb.time_column("capsules.created_at")

  cross_db_uuid :id, :owner_id
  cross_db_timestamp :open_at, :created_at, :updated_at
  # in_plaza 在 SQLite 是 INTEGER 0/1、在 PG 是 boolean——统一转 Ruby 布尔（0 在 Ruby 为真值，必须转）。
  attribute :in_plaza, :boolean

  before_create { self.id = SecureRandom.uuid if id.blank? }
end
