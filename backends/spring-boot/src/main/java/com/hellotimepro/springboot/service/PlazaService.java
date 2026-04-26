package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.domain.CapsuleEntity;
import com.hellotimepro.springboot.domain.FavoriteEntity;
import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.dto.Dtos.CapsuleListItem;
import com.hellotimepro.springboot.dto.Dtos.Paginated;
import com.hellotimepro.springboot.dto.Dtos.Pagination;
import com.hellotimepro.springboot.repository.CapsuleRepository;
import com.hellotimepro.springboot.repository.FavoriteRepository;
import com.hellotimepro.springboot.repository.UserRepository;
import com.hellotimepro.springboot.web.ApiException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class PlazaService {
  private final CapsuleRepository capsules;
  private final UserRepository users;
  private final FavoriteRepository favorites;
  private final MapperService mapper;

  public PlazaService(CapsuleRepository capsules, UserRepository users, FavoriteRepository favorites,
      MapperService mapper) {
    this.capsules = capsules;
    this.users = users;
    this.favorites = favorites;
    this.mapper = mapper;
  }

  public Paginated<CapsuleListItem> plazaList(String sort, String filter, String q, int page, int pageSize, String viewerId) {
    validatePage(page, pageSize);
    if (!sort.equals("hot") && !sort.equals("new")) throw ApiException.validation("sort 仅支持 hot/new", "sort");
    if (!filter.equals("all") && !filter.equals("opened") && !filter.equals("unopened")) {
      throw ApiException.validation("filter 仅支持 all/opened/unopened", "filter");
    }
    String normalizedQuery = q == null ? null : q.trim().toLowerCase(Locale.ROOT);
    if (normalizedQuery != null && normalizedQuery.isEmpty()) normalizedQuery = null;
    if (normalizedQuery != null && normalizedQuery.length() > 50) {
      throw ApiException.validation("q 长度不得超过 50", "q");
    }
    String qPattern = normalizedQuery == null ? null : "%" + escapeLike(normalizedQuery) + "%";

    Pageable pageable = PageRequest.of(page - 1, pageSize, sortOf(sort));
    Page<CapsuleEntity> pageResult = capsules.findPlazaPage(filter, now(), qPattern, pageable);

    List<CapsuleEntity> items = pageResult.getContent();
    Map<UUID, UserEntity> ownerMap = loadOwners(items.stream().map(CapsuleEntity::getOwnerId).toList());
    Set<UUID> faved = loadFavoriteSet(viewerId, items.stream().map(CapsuleEntity::getId).toList());

    List<CapsuleListItem> dto = items.stream()
        .map(c -> mapper.listItem(c, ownerMap.get(c.getOwnerId()), faved.contains(c.getId()), null))
        .toList();
    return new Paginated<>(dto, pagination(pageResult.getTotalElements(), page, pageSize));
  }

  public Paginated<CapsuleListItem> myCapsules(UserEntity user, int page, int pageSize) {
    validatePage(page, pageSize);
    Pageable pageable = PageRequest.of(page - 1, pageSize);
    Page<CapsuleEntity> pageResult = capsules.findByOwnerIdOrderByCreatedAtDesc(user.getId(), pageable);
    List<CapsuleListItem> dto = pageResult.getContent().stream()
        .map(c -> mapper.listItem(c, user, false, null))
        .toList();
    return new Paginated<>(dto, pagination(pageResult.getTotalElements(), page, pageSize));
  }

  public Paginated<CapsuleListItem> myFavorites(UserEntity user, int page, int pageSize) {
    validatePage(page, pageSize);
    Pageable pageable = PageRequest.of(page - 1, pageSize);
    Page<FavoriteEntity> pageResult = favorites.findByIdUserIdOrderByCreatedAtDesc(user.getId(), pageable);
    List<FavoriteEntity> favs = pageResult.getContent();
    if (favs.isEmpty()) {
      return new Paginated<>(List.of(), pagination(pageResult.getTotalElements(), page, pageSize));
    }
    List<UUID> capsuleIds = favs.stream().map(f -> f.getId().getCapsuleId()).toList();
    Map<UUID, CapsuleEntity> capsuleMap = capsules.findAllById(capsuleIds).stream()
        .collect(Collectors.toMap(CapsuleEntity::getId, Function.identity()));
    Map<UUID, UserEntity> ownerMap = loadOwners(
        capsuleMap.values().stream().map(CapsuleEntity::getOwnerId).toList());

    List<CapsuleListItem> dto = new ArrayList<>(favs.size());
    for (FavoriteEntity f : favs) {
      CapsuleEntity c = capsuleMap.get(f.getId().getCapsuleId());
      if (c == null) continue;
      dto.add(mapper.listItem(c, ownerMap.get(c.getOwnerId()), true, f.getCreatedAt()));
    }
    return new Paginated<>(dto, pagination(pageResult.getTotalElements(), page, pageSize));
  }

  private Sort sortOf(String sort) {
    if (sort.equals("hot")) {
      return Sort.by(Sort.Order.desc("favoriteCount"), Sort.Order.desc("createdAt"));
    }
    return Sort.by(Sort.Order.desc("createdAt"));
  }

  private Map<UUID, UserEntity> loadOwners(List<UUID> ownerIds) {
    if (ownerIds.isEmpty()) return Map.of();
    Set<UUID> unique = new HashSet<>(ownerIds);
    Map<UUID, UserEntity> map = new HashMap<>();
    for (UserEntity u : users.findAllById(unique)) {
      map.put(u.getId(), u);
    }
    return map;
  }

  private Set<UUID> loadFavoriteSet(String viewerId, List<UUID> capsuleIds) {
    if (viewerId == null || capsuleIds.isEmpty()) return Set.of();
    return favorites.findByIdUserIdAndIdCapsuleIdIn(UUID.fromString(viewerId), capsuleIds).stream()
        .map(f -> f.getId().getCapsuleId())
        .collect(Collectors.toSet());
  }

  private String escapeLike(String input) {
    return input.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
  }

  private Pagination pagination(long total, int page, int pageSize) {
    return new Pagination(page, pageSize, total, pageSize == 0 ? 0 : (int) Math.ceil(total / (double) pageSize));
  }

  private void validatePage(int page, int pageSize) {
    if (page < 1) throw ApiException.validation("page 必须 >= 1", "page");
    if (pageSize < 1 || pageSize > 50) throw ApiException.validation("pageSize 范围 1-50", "pageSize");
  }

  private OffsetDateTime now() {
    return OffsetDateTime.now(ZoneOffset.UTC);
  }
}
