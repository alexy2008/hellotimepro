package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.web.ApiException;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CapsuleServiceTest {
  @Test
  void openAtUsesUtcCalendarYearsAndClampsLeapDay() {
    var now = OffsetDateTime.parse("2028-03-01T01:30:45.123+08:00");
    var limit = OffsetDateTime.parse("2038-02-28T17:30:45.123Z");
    assertThrows(ApiException.class, () -> CapsuleService.validateOpenAt(now.plusSeconds(60), now));
    assertDoesNotThrow(() -> CapsuleService.validateOpenAt(now.plusSeconds(60).plusNanos(1), now));
    assertDoesNotThrow(() -> CapsuleService.validateOpenAt(limit, now));
    assertThrows(ApiException.class, () -> CapsuleService.validateOpenAt(limit.plusNanos(1), now));
  }
}
