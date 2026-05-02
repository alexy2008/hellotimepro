package com.hellotimepro.springboot.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Converter(autoApply = true)
public class OffsetDateTimeStringConverter implements AttributeConverter<OffsetDateTime, Timestamp> {
  @Override
  public Timestamp convertToDatabaseColumn(OffsetDateTime value) {
    return value == null ? null : Timestamp.from(value.toInstant());
  }

  @Override
  public OffsetDateTime convertToEntityAttribute(Timestamp value) {
    return value == null ? null : value.toInstant().atOffset(ZoneOffset.UTC);
  }
}
