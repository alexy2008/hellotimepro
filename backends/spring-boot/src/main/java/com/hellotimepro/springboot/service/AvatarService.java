package com.hellotimepro.springboot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellotimepro.springboot.config.AppProperties;
import com.hellotimepro.springboot.dto.Dtos.Avatar;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class AvatarService {
  private final AppProperties props;
  private final ObjectMapper mapper;
  private List<Avatar> avatars = List.of();
  private Set<String> ids = Set.of();

  public AvatarService(AppProperties props, ObjectMapper mapper) {
    this.props = props;
    this.mapper = mapper;
  }

  @PostConstruct
  void load() throws IOException {
    Path catalog = Path.of(props.getRepoRoot()).toAbsolutePath().normalize()
        .resolve("spec/avatars/catalog.json");
    JsonNode root = mapper.readTree(catalog.toFile()).path("avatars");
    List<Avatar> loaded = new ArrayList<>();
    for (JsonNode item : root) {
      loaded.add(new Avatar(
          item.path("id").asText(),
          item.path("name").asText(),
          item.path("primaryColor").asText(),
          item.path("svgUrl").asText()));
    }
    avatars = List.copyOf(loaded);
    ids = avatars.stream().map(Avatar::id).collect(Collectors.toUnmodifiableSet());
  }

  public List<Avatar> list() {
    return avatars;
  }

  public boolean exists(String id) {
    return ids.contains(id);
  }
}
