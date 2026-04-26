package com.hellotimepro.springboot.repository;

import com.hellotimepro.springboot.domain.FavoriteEntity;
import com.hellotimepro.springboot.domain.FavoriteId;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FavoriteRepository extends JpaRepository<FavoriteEntity, FavoriteId> {
  List<FavoriteEntity> findByIdUserIdOrderByCreatedAtDesc(UUID userId);
  Page<FavoriteEntity> findByIdUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
  List<FavoriteEntity> findByIdUserIdAndIdCapsuleIdIn(UUID userId, Collection<UUID> capsuleIds);
  void deleteByIdCapsuleId(UUID capsuleId);
}
