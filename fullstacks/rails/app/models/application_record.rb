class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # 仅在 SQLite 下把跨库自定义类型挂到列上；Postgres 走 AR 原生 uuid / timestamptz。
  def self.cross_db_uuid(*names)
    return unless AppConfig.sqlite?

    names.each { |n| attribute n, CrossDb::SqliteUuidType.new }
  end

  def self.cross_db_timestamp(*names)
    return unless AppConfig.sqlite?

    names.each { |n| attribute n, CrossDb::SqliteTimestampType.new }
  end

  # Postgres 支持 SELECT ... FOR UPDATE 行锁；SQLite 不支持，靠单写事务串行化。
  def self.row_lock(relation)
    AppConfig.sqlite? ? relation : relation.lock
  end
end
