package com.hellotimepro.springmvc.repository;

import com.hellotimepro.springmvc.domain.FavoriteEntity;
import com.hellotimepro.springmvc.domain.FavoriteId;
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
