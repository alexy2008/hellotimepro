package com.hellotimepro.springboot.repository;

import com.hellotimepro.springboot.domain.CapsuleEntity;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CapsuleRepository extends JpaRepository<CapsuleEntity, UUID> {
  Optional<CapsuleEntity> findByCode(String code);
  boolean existsByCode(String code);
  List<CapsuleEntity> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);
  Page<CapsuleEntity> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId, Pageable pageable);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select c from CapsuleEntity c where c.id = :id")
  Optional<CapsuleEntity> findByIdForUpdate(@Param("id") UUID id);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update CapsuleEntity c set c.favoriteCount = c.favoriteCount + 1 where c.id = :id")
  int incrementFavoriteCount(@Param("id") UUID id);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update CapsuleEntity c set c.favoriteCount = c.favoriteCount - 1 where c.id = :id and c.favoriteCount > 0")
  int decrementFavoriteCount(@Param("id") UUID id);

  @Query("""
      select c from CapsuleEntity c
      where c.inPlaza = true
        and ( :filter = 'all'
              or ( :filter = 'opened'   and c.openAt <= :now )
              or ( :filter = 'unopened' and c.openAt >  :now ) )
        and ( :q is null
              or lower(c.title) like :q
              or exists (
                   select 1 from UserEntity u
                    where u.id = c.ownerId and lower(u.nickname) like :q
                 ) )
      """)
  Page<CapsuleEntity> findPlazaPage(
      @Param("filter") String filter,
      @Param("now") OffsetDateTime now,
      @Param("q") String qPattern,
      Pageable pageable);
}
