package com.hellotimepro.springboot.repository;

import com.hellotimepro.springboot.domain.CapsuleEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CapsuleRepository extends JpaRepository<CapsuleEntity, String> {
  Optional<CapsuleEntity> findByCode(String code);
  boolean existsByCode(String code);
  List<CapsuleEntity> findByOwnerIdOrderByCreatedAtDesc(String ownerId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select c from CapsuleEntity c where c.id = :id")
  Optional<CapsuleEntity> findByIdForUpdate(@Param("id") String id);
}
