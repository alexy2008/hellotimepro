package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.domain.CapsuleEntity;
import com.hellotimepro.springboot.domain.FavoriteEntity;
import com.hellotimepro.springboot.domain.FavoriteId;
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
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
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
    String query = normalizedQuery;

    OffsetDateTime now = now();
    Map<String, UserEntity> ownerMap = users.findAll().stream()
        .collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    List<CapsuleEntity> filtered = capsules.findAll().stream()
        .filter(CapsuleEntity::isInPlaza)
        .filter(c -> filter.equals("all") || (filter.equals("opened") == !c.getOpenAt().isAfter(now)))
        .filter(c -> matches(c, ownerMap.get(c.getOwnerId()), query))
        .sorted(comparator(sort))
        .toList();

    Set<String> faved = favoriteIds(viewerId);
    List<CapsuleListItem> items = page(filtered, page, pageSize).stream()
        .map(c -> mapper.listItem(c, ownerMap.get(c.getOwnerId()), faved.contains(c.getId()), null))
        .toList();
    return new Paginated<>(items, pagination(filtered.size(), page, pageSize));
  }

  public Paginated<CapsuleListItem> myCapsules(UserEntity user, int page, int pageSize) {
    validatePage(page, pageSize);
    List<CapsuleEntity> all = capsules.findByOwnerIdOrderByCreatedAtDesc(user.getId());
    List<CapsuleListItem> items = page(all, page, pageSize).stream()
        .map(c -> mapper.listItem(c, user, false, null))
        .toList();
    return new Paginated<>(items, pagination(all.size(), page, pageSize));
  }

  public Paginated<CapsuleListItem> myFavorites(UserEntity user, int page, int pageSize) {
    validatePage(page, pageSize);
    List<FavoriteEntity> all = favorites.findByIdUserIdOrderByCreatedAtDesc(user.getId());
    Map<String, UserEntity> ownerMap = users.findAll().stream()
        .collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    List<CapsuleListItem> items = page(all, page, pageSize).stream()
        .map(f -> capsules.findById(f.getId().getCapsuleId())
            .map(c -> mapper.listItem(c, ownerMap.get(c.getOwnerId()), true, f.getCreatedAt()))
            .orElse(null))
        .filter(i -> i != null)
        .toList();
    return new Paginated<>(items, pagination(all.size(), page, pageSize));
  }

  private boolean matches(CapsuleEntity c, UserEntity owner, String query) {
    if (query == null) return true;
    String title = c.getTitle().toLowerCase(Locale.ROOT);
    String nickname = owner == null ? "" : owner.getNickname().toLowerCase(Locale.ROOT);
    return title.contains(query) || nickname.contains(query);
  }

  private Comparator<CapsuleEntity> comparator(String sort) {
    if (sort.equals("hot")) {
      return Comparator.comparingInt(CapsuleEntity::getFavoriteCount).reversed()
          .thenComparing(CapsuleEntity::getCreatedAt, Comparator.reverseOrder());
    }
    return Comparator.comparing(CapsuleEntity::getCreatedAt, Comparator.reverseOrder());
  }

  private Set<String> favoriteIds(String viewerId) {
    if (viewerId == null) return Set.of();
    return favorites.findByIdUserIdOrderByCreatedAtDesc(viewerId).stream()
        .map(f -> f.getId().getCapsuleId())
        .collect(Collectors.toSet());
  }

  private <T> List<T> page(List<T> all, int page, int pageSize) {
    int start = Math.min((page - 1) * pageSize, all.size());
    int end = Math.min(start + pageSize, all.size());
    return all.subList(start, end);
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
