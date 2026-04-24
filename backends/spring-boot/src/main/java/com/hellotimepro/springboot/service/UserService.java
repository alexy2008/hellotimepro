package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.dto.Dtos.UpdateProfileRequest;
import com.hellotimepro.springboot.dto.Dtos.UserOut;
import com.hellotimepro.springboot.repository.UserRepository;
import com.hellotimepro.springboot.web.ApiException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
  private final UserRepository users;
  private final AvatarService avatars;
  private final MapperService mapper;

  public UserService(UserRepository users, AvatarService avatars, MapperService mapper) {
    this.users = users;
    this.avatars = avatars;
    this.mapper = mapper;
  }

  public UserOut toOut(UserEntity user) {
    return mapper.user(user);
  }

  @Transactional
  public UserOut updateProfile(UserEntity user, UpdateProfileRequest req) {
    if (req.nickname() == null && req.avatarId() == null) {
      throw ApiException.validation("至少提供一个字段", "body");
    }
    if (req.nickname() != null && !req.nickname().equals(user.getNickname())) {
      if (users.existsByNickname(req.nickname())) throw ApiException.conflict("昵称已被使用", "nickname");
      user.setNickname(req.nickname());
    }
    if (req.avatarId() != null) {
      if (!avatars.exists(req.avatarId())) throw ApiException.validation("头像 ID 不存在", "avatarId");
      user.setAvatarId(req.avatarId());
    }
    user.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
    return mapper.user(users.save(user));
  }
}
