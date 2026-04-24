package com.hellotimepro.springboot.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Converter(autoApply = true)
public class OffsetDateTimeStringConverter implements AttributeConverter<OffsetDateTime, String> {
  @Override
  public String convertToDatabaseColumn(OffsetDateTime attribute) {
    return attribute == null ? null : attribute.withOffsetSameInstant(ZoneOffset.UTC).toString();
  }

  @Override
  public OffsetDateTime convertToEntityAttribute(String dbData) {
    return dbData == null ? null : OffsetDateTime.parse(dbData);
  }
}
