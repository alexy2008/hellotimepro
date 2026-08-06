from datetime import datetime, timedelta, timezone

from sqlalchemy.dialects import sqlite

from app.db.types import UTCDateTime, sqlite_utc_timestamp


def test_sqlite_timestamp_matches_seed_format_and_string_order():
    seed = "2026-07-13T01:00:00+00:00"
    app_later = sqlite_utc_timestamp(datetime(2026, 7, 13, 23, 0, tzinfo=timezone.utc))
    assert app_later == "2026-07-13T23:00:00+00:00"
    assert seed < app_later


def test_sqlite_timestamp_normalizes_offset_and_trims_fraction():
    value = datetime(2026, 7, 13, 18, 0, 0, 120000, tzinfo=timezone(timedelta(hours=8)))
    assert sqlite_utc_timestamp(value) == "2026-07-13T10:00:00.12+00:00"


def test_sqlalchemy_sqlite_bind_processor_uses_canonical_text():
    dialect = sqlite.dialect()
    processor = UTCDateTime().dialect_impl(dialect).bind_processor(dialect)
    assert processor is not None
    assert processor(datetime(2026, 7, 13, 23, 0, tzinfo=timezone.utc)) == (
        "2026-07-13T23:00:00+00:00"
    )
