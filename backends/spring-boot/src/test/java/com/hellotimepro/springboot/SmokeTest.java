package com.hellotimepro.springboot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SmokeTest {
  @Autowired TestRestTemplate http;
  @Autowired ObjectMapper mapper;
  @Autowired JdbcTemplate jdbc;
  @LocalServerPort int port;

  @BeforeEach
  void reset() {
    jdbc.update("delete from favorites");
    jdbc.update("delete from refresh_tokens");
    jdbc.update("delete from capsules");
    jdbc.update("delete from users");
  }

  @Test
  void healthAndAvatars() throws Exception {
    JsonNode health = get("/api/v1/health");
    assertThat(health.path("success").asBoolean()).isTrue();
    assertThat(health.path("data").path("service").asText()).isEqualTo("hellotime-pro");
    assertThat(health.path("data").path("stack").path("kind").asText()).isEqualTo("backend");

    JsonNode avatars = get("/api/v1/avatars");
    assertThat(avatars.path("data")).hasSize(10);
  }

  @Test
  void mainFlowAndRefreshRotate() throws Exception {
    JsonNode alice = register("alice@hellotime.pro", "alice", "neo");
    String access = alice.path("accessToken").asText();
    String refresh = alice.path("refreshToken").asText();

    String openAt = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1).toString();
    JsonNode capsule = post("/api/v1/capsules", Map.of(
        "title", "Hello Future",
        "content", "Secret note",
        "openAt", openAt,
        "inPlaza", true), access, HttpStatus.CREATED).path("data");
    String code = capsule.path("code").asText();
    String capsuleId = capsule.path("id").asText();

    JsonNode sealed = get("/api/v1/capsules/" + code);
    assertThat(sealed.path("data").path("content").isNull()).isTrue();

    JsonNode bob = register("bob@hellotime.pro", "bob", "specter");
    JsonNode favorite = post("/api/v1/me/favorites", Map.of("capsuleId", capsuleId),
        bob.path("accessToken").asText(), HttpStatus.OK);
    assertThat(favorite.path("data").path("favoriteCount").asInt()).isEqualTo(1);

    JsonNode plaza = get("/api/v1/plaza/capsules?sort=hot");
    assertThat(plaza.path("data").path("items").get(0).path("id").asText()).isEqualTo(capsuleId);

    JsonNode rotated = post("/api/v1/auth/refresh", Map.of("refreshToken", refresh), null, HttpStatus.OK);
    String refresh2 = rotated.path("data").path("refreshToken").asText();
    assertThat(refresh2).isNotEqualTo(refresh);

    assertThat(rawPostStatus("/api/v1/auth/refresh", Map.of("refreshToken", refresh))).isEqualTo(401);
    assertThat(rawPostStatus("/api/v1/auth/refresh", Map.of("refreshToken", refresh2))).isEqualTo(401);
  }

  private JsonNode register(String email, String nickname, String avatar) throws Exception {
    return post("/api/v1/auth/register", Map.of(
        "email", email,
        "password", "password123",
        "nickname", nickname,
        "avatarId", avatar), null, HttpStatus.CREATED).path("data");
  }

  private JsonNode get(String path) throws Exception {
    ResponseEntity<String> response = http.getForEntity(path, String.class);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    return mapper.readTree(response.getBody());
  }

  private JsonNode post(String path, Object body, String accessToken, HttpStatus expected) throws Exception {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (accessToken != null) headers.setBearerAuth(accessToken);
    ResponseEntity<String> response = http.exchange(path, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
    assertThat(response.getStatusCode()).isEqualTo(expected);
    return response.getBody() == null || response.getBody().isBlank()
        ? mapper.createObjectNode()
        : mapper.readTree(response.getBody());
  }

  private int rawPostStatus(String path, Object body) throws Exception {
    HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
        .build();
    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString()).statusCode();
  }
}
