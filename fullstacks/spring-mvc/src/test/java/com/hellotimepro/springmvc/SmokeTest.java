package com.hellotimepro.springmvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
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
    assertThat(health.path("data").path("version").asText()).isEqualTo("2.0.0");
    assertThat(health.path("data").path("stack").path("kind").asText()).isEqualTo("fullstack");

    JsonNode avatars = get("/api/v1/avatars");
    assertThat(avatars.path("data")).hasSize(10);
  }

  @Test
  void plazaStatsAndListShareLiteralSearch() throws Exception {
    JsonNode empty = get("/api/v1/plaza/stats").path("data");
    assertThat(empty.path("counts").path("all").asInt()).isZero();
    assertThat(empty.path("farthestOpenAt").isNull()).isTrue();
    assertThat(empty.path("nextOpenAt").isNull()).isTrue();

    String alice = register("alice@hellotime.pro", "Writer_One", "neo").path("accessToken").asText();
    String bob = register("bob@hellotime.pro", "WriterXOne", "nova").path("accessToken").asText();
    OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC).withNano(0);
    createCapsule(alice, "Report%_\\", now.plusHours(1), true);
    createCapsule(bob, "ReportXYZ", now.plusHours(2), true);
    createCapsule(alice, "Report%_\\", now.plusHours(3), false);

    for (String search : List.of("  REPORT%_\\  ", "\\", "%", "_", "WRITER_ONE")) {
      JsonNode stats = get("/api/v1/plaza/stats?q={search}", search).path("data");
      assertThat(stats.path("counts").path("all").asInt()).isEqualTo(1);
      assertThat(stats.path("counts").path("opened").asInt()).isZero();
      assertThat(stats.path("counts").path("unopened").asInt()).isEqualTo(1);
      assertThat(OffsetDateTime.parse(stats.path("nextOpenAt").asText())).isEqualTo(now.plusHours(1));
      assertThat(OffsetDateTime.parse(stats.path("farthestOpenAt").asText())).isEqualTo(now.plusHours(2));
      for (String filter : List.of("all", "opened", "unopened")) {
        JsonNode pagination = get("/api/v1/plaza/capsules?filter={filter}&q={search}", filter, search)
            .path("data").path("pagination");
        assertThat(pagination.path("total").asInt()).isEqualTo(stats.path("counts")
            .path(filter).asInt());
      }
    }
  }

  @Test
  void favoritePrivateCapsuleAndDeleteUpdatesBothUsersStatsWithoutForeignKeyCascade() throws Exception {
    String alice = register("alice@hellotime.pro", "alice", "neo").path("accessToken").asText();
    String bob = register("bob@hellotime.pro", "bob", "nova").path("accessToken").asText();
    String id = createCapsule(alice, "Private", OffsetDateTime.now(ZoneOffset.UTC).plusHours(1), false)
        .path("id").asText();
    assertThat(post("/api/v1/me/favorites", Map.of("capsuleId", "invalid"), alice,
        HttpStatus.UNPROCESSABLE_ENTITY).path("errorCode").asText()).isEqualTo("VALIDATION_ERROR");
    for (String token : List.of(alice, alice, bob)) {
      post("/api/v1/me/favorites", Map.of("capsuleId", id), token, HttpStatus.OK);
    }
    JsonNode owned = authenticatedGet("/api/v1/me/capsules", alice).path("items").get(0);
    assertThat(owned.path("favoritedByMe").asBoolean()).isTrue();
    assertThat(owned.path("favoritedAt").isNull()).isTrue();
    JsonNode stats = authenticatedGet("/api/v1/me/stats", alice);
    assertThat(stats.path("created").asInt()).isEqualTo(1);
    assertThat(stats.path("unopened").asInt()).isEqualTo(1);
    assertThat(stats.path("inPlaza").asInt()).isZero();
    assertThat(stats.path("favoritesReceived").asInt()).isEqualTo(2);
    assertThat(stats.path("favoritesGiven").asInt()).isEqualTo(1);
    assertThat(authenticatedGet("/api/v1/me/favorites", bob).path("items").get(0).path("inPlaza").asBoolean())
        .isFalse();

    // 显式关闭 SQLite 外键级联，验证服务层显式先删收藏再删胶囊
    jdbc.execute("PRAGMA foreign_keys = OFF");
    try {
      HttpHeaders headers = new HttpHeaders();
      headers.setBearerAuth(alice);
      assertThat(http.exchange("/api/v1/me/capsules/{id}", HttpMethod.DELETE,
          new HttpEntity<>(headers), Void.class, id).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
      assertThat(authenticatedGet("/api/v1/me/stats", alice).path("favoritesReceived").asInt()).isZero();
      assertThat(authenticatedGet("/api/v1/me/stats", bob).path("favoritesGiven").asInt()).isZero();
      assertThat(authenticatedGet("/api/v1/me/favorites", bob).path("items")).isEmpty();
      assertThat(jdbc.queryForObject("select count(*) from favorites", Integer.class)).isZero();
    } finally {
      jdbc.execute("PRAGMA foreign_keys = ON");
    }
  }

  @Test
  void malformedCapsuleIdsInPathAreValidationErrors() throws Exception {
    String alice = register("alice@hellotime.pro", "alice", "neo").path("accessToken").asText();
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(alice);
    HttpEntity<Void> auth = new HttpEntity<>(headers);
    for (String bad : List.of("not-a-uuid", "1-1-1-1-1")) {
      for (var call : List.of(
          Map.entry(HttpMethod.GET, "/api/v1/plaza/capsules/{id}"),
          Map.entry(HttpMethod.DELETE, "/api/v1/me/capsules/{id}"),
          Map.entry(HttpMethod.DELETE, "/api/v1/me/favorites/{id}"))) {
        ResponseEntity<String> response = http.exchange(call.getValue(), call.getKey(), auth, String.class, bad);
        assertThat(response.getStatusCode()).as("%s %s", call.getKey(), bad)
            .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(mapper.readTree(response.getBody()).path("errorCode").asText()).isEqualTo("VALIDATION_ERROR");
      }
    }

    String missing = "00000000-0000-4000-8000-000000000000";
    assertThat(http.exchange("/api/v1/plaza/capsules/{id}", HttpMethod.GET, auth, String.class, missing)
        .getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(http.exchange("/api/v1/me/capsules/{id}", HttpMethod.DELETE, auth, String.class, missing)
        .getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(http.exchange("/api/v1/me/favorites/{id}", HttpMethod.DELETE, auth, String.class, missing)
        .getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
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

  @Test
  void ssrPagesAndErrorFallbackRenderCleanly() throws Exception {
    for (String page : List.of("/", "/open", "/about", "/login", "/register", "/capsules/NOSUCH99")) {
      ResponseEntity<String> res = http.getForEntity(page, String.class);
      assertThat(res.getStatusCode()).as("GET %s", page).isEqualTo(HttpStatus.OK);
      assertThat(res.getBody()).contains("data-skin-view=\"paper\"").contains("data-skin-view=\"amber\"");
    }

    ResponseEntity<String> missing = http.getForEntity("/no/such/page", String.class);
    assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(missing.getBody()).contains("data-testid=\"not-found\"");

    HttpClient noRedirect = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    HttpResponse<String> guard = noRedirect.send(
        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/create")).GET().build(),
        HttpResponse.BodyHandlers.ofString());
    assertThat(guard.statusCode()).isEqualTo(302);
    assertThat(guard.headers().firstValue("Location").orElse("")).endsWith("/login?redirect=%2Fcreate");
  }

  private JsonNode createCapsule(String token, String title, OffsetDateTime openAt, boolean inPlaza) throws Exception {
    return post("/api/v1/capsules", Map.of("title", title, "content", "Test note",
        "openAt", openAt.toString(), "inPlaza", inPlaza), token, HttpStatus.CREATED).path("data");
  }

  private JsonNode authenticatedGet(String path, String token) throws Exception {
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(token);
    ResponseEntity<String> response = http.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    return mapper.readTree(response.getBody()).path("data");
  }

  private JsonNode register(String email, String nickname, String avatar) throws Exception {
    return post("/api/v1/auth/register", Map.of(
        "email", email,
        "password", "password123",
        "nickname", nickname,
        "avatarId", avatar), null, HttpStatus.CREATED).path("data");
  }

  private JsonNode get(String path, Object... params) throws Exception {
    ResponseEntity<String> response = http.getForEntity(path, String.class, params);
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
