require "minitest/autorun"

connection = ActiveRecord::Base.connection
connection.raw_connection.execute_batch(File.read(File.join(AppConfig.repo_root, "spec/db/schema.sqlite.sql")))
connection.execute("PRAGMA foreign_keys = OFF")

class RailsUpgradeTest < Minitest::Test
  NOW = Time.utc(2028, 2, 29, 8, 0, 0)

  def before_setup
    super
    ActiveRecord::Base.connection.begin_transaction(joinable: false)
  end

  def after_teardown
    ActiveRecord::Base.connection.rollback_transaction
    super
  end

  def test_calendar_year_limit_clamps_leap_day
    maximum = Time.utc(2038, 2, 28, 8, 0, 0)
    CapsuleService.validate_open_at!(maximum, NOW)
    assert_raises(ApiError) { CapsuleService.validate_open_at!(maximum + 1, NOW) }
    assert_raises(ApiError) { CapsuleService.validate_open_at!(NOW + 60, NOW) }
    CapsuleService.validate_open_at!(NOW + 61, NOW)
  end

  def test_literal_unicode_search_and_consistent_statistics
    author = user("Écho")
    past = capsule(author, title: "Café A_%\\OK", time: NOW - 1)
    future = capsule(author, title: "Café AzzOK", time: NOW + 1)
    capsule(author, title: "Café A_%\\Privé", time: NOW + 86400, published: false)
    stats = PlazaService.plaza_stats(q: "  a_%\\ok ", now: NOW)
    assert_equal({ all: 1, opened: 1, unopened: 0 }, stats[:counts])
    assert_equal future.open_at.iso8601, stats[:farthestOpenAt]
    assert_equal future.open_at.iso8601, stats[:nextOpenAt]
    assert_equal [past.id], plaza("a_%\\ok", "opened")[:items].map { |entry| entry[:id] }
    assert_equal 0, plaza("a_%\\ok", "unopened")[:pagination][:total]
    assert_equal 2, plaza("éCHO", "all")[:pagination][:total]
    assert_raises(ApiError) { PlazaService.plaza_stats(q: "𠮷" * 51, now: NOW) }
  end

  def test_exact_sqlite_order_at_a_fraction_of_a_second
    author = user("时间")
    exact = capsule(author, title: "整秒", time: NOW)
    fraction = capsule(author, title: "小数秒", time: NOW + Rational(1, 10_000))
    stats = PlazaService.plaza_stats(q: nil, now: NOW)
    assert_equal({ all: 2, opened: 1, unopened: 1 }, stats[:counts])
    assert_equal [exact.id], plaza(nil, "opened")[:items].map { |item| item[:id] }
    assert_equal fraction.id, plaza(nil, "unopened")[:items].first[:id]
    assert_equal "2028-02-29T08:00:00.0001Z", stats[:nextOpenAt]
  end

  def test_empty_statistics_and_nullable_times
    stats = PlazaService.plaza_stats(q: nil, now: NOW)
    assert_equal({ all: 0, opened: 0, unopened: 0 }, stats[:counts])
    assert_nil stats.fetch(:farthestOpenAt)
    assert_nil stats.fetch(:nextOpenAt)
  end

  def test_private_self_favorite_and_delete_with_foreign_keys_disabled
    author = user("作者")
    another = user("读者")
    written = capsule(author, title: "未公开", time: NOW + 120, published: false, dashed: true)
    assert_equal 0, ActiveRecord::Base.connection.select_value("PRAGMA foreign_keys")

    first = FavoriteService.add_favorite(author, written.id)
    assert_equal first, FavoriteService.add_favorite(author, written.id)
    FavoriteService.add_favorite(another, written.id)
    assert_equal 2, written.reload.favorite_count
    assert PlazaService.my_capsules(author, 1, 20)[:items].first[:favoritedByMe]
    assert_equal false, PlazaService.my_favorites(author, 1, 20)[:items].first[:inPlaza]
    assert_equal({ created: 1, opened: 0, unopened: 1, inPlaza: 0, favoritesReceived: 2, favoritesGiven: 1 },
                 PlazaService.my_stats(author, now: NOW))

    FavoriteService.remove_favorite(another, written.id)
    FavoriteService.remove_favorite(another, written.id)
    assert_equal 1, written.reload.favorite_count

    CapsuleService.delete_own(author, written.id)
    assert_empty Favorite.all
    assert_nil Capsule.by_uuid(written.id).first
    assert_equal 0, PlazaService.my_stats(author, now: NOW)[:favoritesGiven]
  end

  def test_malformed_path_uuid_returns_validation_error
    author = user("参数")
    session = ActionDispatch::Integration::Session.new(Rails.application)
    headers = { "Authorization" => "Bearer #{SecurityService.create_access_token(author)}" }
    [
      [:get, "/api/v1/plaza/capsules/not-a-uuid"],
      [:delete, "/api/v1/me/capsules/not-a-uuid"],
      [:delete, "/api/v1/me/favorites/not-a-uuid"],
    ].each do |verb, path|
      session.public_send(verb, path, headers: headers)
      assert_equal 422, session.response.status
      assert_equal "VALIDATION_ERROR", session.response.parsed_body.fetch("errorCode")
    end
    session.delete("/api/v1/me/favorites/#{SecureRandom.uuid}", headers: headers)
    assert_equal 204, session.response.status
  end

  private

  def user(nickname)
    User.create!(email: "#{SecureRandom.hex(6)}@example.test", password_hash: "unused", nickname: nickname, avatar_id: "neo")
  end

  def capsule(author, title:, time:, published: true, dashed: false)
    id = CrossDb::StoredUuid.new(SecureRandom.uuid) if dashed
    Capsule.create!(id: id, owner: author, code: SecureRandom.hex(4).upcase, title: title, content: "测试正文",
                    open_at: time, in_plaza: published, created_at: NOW - 86400)
  end

  def plaza(q, filter)
    PlazaService.plaza_list(sort: "new", filter: filter, q: q, page: 1, page_size: 20, viewer_id: nil, now: NOW)
  end
end
