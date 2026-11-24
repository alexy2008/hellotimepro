package com.hellotimepro.springmvc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellotimepro.springmvc.config.AppProperties;
import com.hellotimepro.springmvc.dto.Dtos.Avatar;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class AvatarService {
  private static final Pattern SVG_OPEN = Pattern.compile("^[\\s\\S]*?<svg[^>]*>");
  private static final Pattern SVG_CLOSE = Pattern.compile("</svg>\\s*$");
  private static final Pattern SVG_TITLE = Pattern.compile("<title>[\\s\\S]*?</title>");

  public record AvatarMeta(String id, String name, String primaryColor, String svgUrl,
      String tagline, String glyph) {}

  private final AppProperties props;
  private final ObjectMapper mapper;
  private List<Avatar> avatars = List.of();
  private List<AvatarMeta> metas = List.of();
  private Map<String, AvatarMeta> byId = Map.of();

  public AvatarService(AppProperties props, ObjectMapper mapper) {
    this.props = props;
    this.mapper = mapper;
  }

  @PostConstruct
  void load() throws IOException {
    Path dir = Path.of(props.getRepoRoot()).toAbsolutePath().normalize()
        .resolve("spec/avatars/v2");
    JsonNode root = mapper.readTree(dir.resolve("catalog.json").toFile()).path("avatars");
    List<Avatar> loaded = new ArrayList<>();
    List<AvatarMeta> loadedMetas = new ArrayList<>();
    Map<String, AvatarMeta> map = new LinkedHashMap<>();
    for (JsonNode item : root) {
      String id = item.path("id").asText();
      String name = item.path("name").asText();
      String color = item.path("primaryColor").asText();
      String svgUrl = item.path("svgUrl").asText();
      String tagline = item.path("tagline").asText("");
      String rawSvg = Files.readString(dir.resolve(id + ".svg"), StandardCharsets.UTF_8);
      String glyph = extractInnerSvg(rawSvg);
      loaded.add(new Avatar(id, name, color, svgUrl));
      AvatarMeta meta = new AvatarMeta(id, name, color, svgUrl, tagline, glyph);
      loadedMetas.add(meta);
      map.put(id, meta);
    }
    avatars = List.copyOf(loaded);
    metas = List.copyOf(loadedMetas);
    byId = Map.copyOf(map);
  }

  private static String extractInnerSvg(String svg) {
    String s = SVG_OPEN.matcher(svg).replaceFirst("");
    s = SVG_CLOSE.matcher(s).replaceFirst("");
    s = SVG_TITLE.matcher(s).replaceAll("");
    return s.trim();
  }

  public List<Avatar> list() {
    return avatars;
  }

  public List<AvatarMeta> metas() {
    return metas;
  }

  public AvatarMeta metaOf(String id) {
    if (id != null && byId.containsKey(id)) return byId.get(id);
    return metas.isEmpty() ? new AvatarMeta("neo", "新生", "#4a7c59", "/static/avatars/neo.svg", "", "") : metas.get(0);
  }

  public Set<String> idSet() {
    return byId.keySet();
  }

  public boolean exists(String id) {
    return byId.containsKey(id);
  }
}
