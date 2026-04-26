package com.hellotimepro.springboot.repository;

import com.hellotimepro.springboot.domain.RefreshTokenEntity;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {
  Optional<RefreshTokenEntity> findByTokenHash(String tokenHash);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select r from RefreshTokenEntity r where r.tokenHash = :tokenHash")
  Optional<RefreshTokenEntity> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

  @Modifying
  @Query("update RefreshTokenEntity r set r.revokedAt = :now where r.familyId = :familyId and r.revokedAt is null")
  int revokeFamily(@Param("familyId") UUID familyId, @Param("now") OffsetDateTime now);

  @Modifying
  @Query("update RefreshTokenEntity r set r.revokedAt = :now where r.userId = :userId and r.revokedAt is null")
  int revokeUser(@Param("userId") UUID userId, @Param("now") OffsetDateTime now);
}
