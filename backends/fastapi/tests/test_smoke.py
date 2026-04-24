"""主流程冒烟：register → login → create capsule → plaza → favorite。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _iso_future(seconds: int = 120) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


def _register(client, email: str, nickname: str, avatar: str = "neo"):
    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "password123",
            "nickname": nickname,
            "avatarId": avatar,
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["success"] is True
    return body["data"]


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["service"] == "hellotime-pro"
    assert body["data"]["stack"]["kind"] == "backend"
    assert any(i["name"] == "FastAPI" for i in body["data"]["stack"]["items"])


def test_avatars(client):
    r = client.get("/api/v1/avatars")
    assert r.status_code == 200
    items = r.json()["data"]
    assert len(items) == 10
    assert {i["id"] for i in items} >= {"neo", "specter", "glyph"}


def test_register_login_flow(client):
    data = _register(client, "alice@hellotime.pro", "alice")
    assert data["accessToken"]
    assert data["refreshToken"]
    assert data["user"]["nickname"] == "alice"

    # 重复邮箱
    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": "alice@hellotime.pro",
            "password": "password123",
            "nickname": "alice2",
            "avatarId": "neo",
        },
    )
    assert r.status_code == 409
    assert r.json()["errorCode"] == "CONFLICT"

    # 登录
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@hellotime.pro", "password": "password123"},
    )
    assert r.status_code == 200
    tokens = r.json()["data"]

    # /me
    r = client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {tokens['accessToken']}"}
    )
    assert r.status_code == 200
    assert r.json()["data"]["email"] == "alice@hellotime.pro"


def test_capsule_create_and_query(client):
    alice = _register(client, "alice@hellotime.pro", "alice")
    h = {"Authorization": f"Bearer {alice['accessToken']}"}

    r = client.post(
        "/api/v1/capsules",
        headers=h,
        json={
            "title": "Hello Future",
            "content": "Secret note",
            "openAt": _iso_future(3600),
            "inPlaza": True,
        },
    )
    assert r.status_code == 201, r.text
    capsule = r.json()["data"]
    assert len(capsule["code"]) == 8
    assert capsule["isOpened"] is False
    assert capsule["favoriteCount"] == 0

    # 未开启按 code 查 → content 为 null
    r = client.get(f"/api/v1/capsules/{capsule['code']}")
    assert r.status_code == 200
    assert r.json()["data"]["content"] is None


def test_plaza_list_and_favorite(client):
    alice = _register(client, "alice@hellotime.pro", "alice")
    bob = _register(client, "bob@hellotime.pro", "bob", avatar="specter")

    # Alice 创建 3 条公开胶囊
    h_a = {"Authorization": f"Bearer {alice['accessToken']}"}
    for i in range(3):
        r = client.post(
            "/api/v1/capsules",
            headers=h_a,
            json={
                "title": f"alice-{i}",
                "content": "c",
                "openAt": _iso_future(120 + i),
                "inPlaza": True,
            },
        )
        assert r.status_code == 201

    # 广场列表（匿名）
    r = client.get("/api/v1/plaza/capsules?sort=new&pageSize=10")
    body = r.json()["data"]
    assert len(body["items"]) == 3
    assert all(i["favoritedByMe"] is False for i in body["items"])

    # Bob 收藏第一个
    first_id = body["items"][0]["id"]
    h_b = {"Authorization": f"Bearer {bob['accessToken']}"}
    r = client.post("/api/v1/me/favorites", headers=h_b, json={"capsuleId": first_id})
    assert r.status_code == 200
    assert r.json()["data"]["favoriteCount"] == 1

    # Bob 再次收藏 —— 幂等
    r = client.post("/api/v1/me/favorites", headers=h_b, json={"capsuleId": first_id})
    assert r.status_code == 200
    assert r.json()["data"]["favoriteCount"] == 1

    # 广场 sort=hot 该条应在顶部
    r = client.get("/api/v1/plaza/capsules?sort=hot")
    assert r.json()["data"]["items"][0]["id"] == first_id

    # Bob 的"我收藏的"
    r = client.get("/api/v1/me/favorites", headers=h_b)
    items = r.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["favoritedByMe"] is True
    assert items[0]["favoritedAt"] is not None


def test_cannot_favorite_own_capsule(client):
    alice = _register(client, "alice@hellotime.pro", "alice")
    h = {"Authorization": f"Bearer {alice['accessToken']}"}
    r = client.post(
        "/api/v1/capsules",
        headers=h,
        json={
            "title": "own",
            "content": "c",
            "openAt": _iso_future(120),
            "inPlaza": True,
        },
    )
    cid = r.json()["data"]["id"]
    r = client.post("/api/v1/me/favorites", headers=h, json={"capsuleId": cid})
    assert r.status_code == 400
    assert r.json()["errorCode"] == "BAD_REQUEST"


def test_refresh_rotate_and_logout(client):
    a = _register(client, "alice@hellotime.pro", "alice")
    rt1 = a["refreshToken"]
    r = client.post("/api/v1/auth/refresh", json={"refreshToken": rt1})
    assert r.status_code == 200
    rt2 = r.json()["data"]["refreshToken"]
    assert rt2 != rt1

    # 旧 refresh 再用 → 整族作废
    r = client.post("/api/v1/auth/refresh", json={"refreshToken": rt1})
    assert r.status_code == 401

    # 此时 rt2 也应失效
    r = client.post("/api/v1/auth/refresh", json={"refreshToken": rt2})
    assert r.status_code == 401


def test_invalid_refresh_token_is_not_500(client):
    for path in ("/api/v1/auth/refresh", "/api/v1/auth/logout"):
        r = client.post(path, json={"refreshToken": "é"})
        assert r.status_code in (204, 401), r.text
        assert r.status_code != 500


def test_change_password_revokes_refresh(client):
    a = _register(client, "alice@hellotime.pro", "alice")
    h = {"Authorization": f"Bearer {a['accessToken']}"}
    r = client.post(
        "/api/v1/me/password",
        headers=h,
        json={"currentPassword": "password123", "newPassword": "password456"},
    )
    assert r.status_code == 204

    # 旧 refresh 应已吊销
    r = client.post("/api/v1/auth/refresh", json={"refreshToken": a["refreshToken"]})
    assert r.status_code == 401
