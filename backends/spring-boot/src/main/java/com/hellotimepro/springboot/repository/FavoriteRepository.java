package com.hellotimepro.springboot.repository;

import com.hellotimepro.springboot.domain.FavoriteEntity;
import com.hellotimepro.springboot.domain.FavoriteId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FavoriteRepository extends JpaRepository<FavoriteEntity, FavoriteId> {
  boolean existsByIdUserIdAndIdCapsuleId(String userId, String capsuleId);
  List<FavoriteEntity> findByIdUserIdOrderByCreatedAtDesc(String userId);
  void deleteByIdCapsuleId(String capsuleId);
}
