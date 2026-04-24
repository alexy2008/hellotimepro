/**
 * favorites-count.spec.ts · favorite_count 与实际收藏行数一致
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, register } from "./_helpers.ts";

async function favCount(capId: string): Promise<number> {
  const r = await api<{ items: Array<{ id: string; favoriteCount: number }> }>(
    "GET",
    "/api/v1/plaza/capsules?pageSize=50",
  );
  const it = r.body.data!.items.find((i) => i.id === capId);
  assert.ok(it, "胶囊应在广场列表中");
  return it!.favoriteCount;
}

test("串行收藏/取消：favoriteCount 与实际收藏行数一致", async () => {
  const owner = await register();
  const cap = await createCapsule(owner.accessToken);
  const fans = await Promise.all([register(), register(), register(), register()]);

  for (const f of fans) {
    const r = await api("POST", "/api/v1/me/favorites", {
      token: f.accessToken,
      json: { capsuleId: cap.id },
    });
    assert.equal(r.status, 200);
  }
  assert.equal(await favCount(cap.id), fans.length);

  // 取消 2 个
  for (const f of fans.slice(0, 2)) {
    await api("DELETE", `/api/v1/me/favorites/${cap.id}`, { token: f.accessToken });
  }
  assert.equal(await favCount(cap.id), fans.length - 2);
});

test("重复收藏/取消不累加：幂等保证不漂移", async () => {
  const owner = await register();
  const fan = await register();
  const cap = await createCapsule(owner.accessToken);

  for (let i = 0; i < 5; i++) {
    await api("POST", "/api/v1/me/favorites", {
      token: fan.accessToken,
      json: { capsuleId: cap.id },
    });
  }
  assert.equal(await favCount(cap.id), 1);

  for (let i = 0; i < 5; i++) {
    await api("DELETE", `/api/v1/me/favorites/${cap.id}`, { token: fan.accessToken });
  }
  assert.equal(await favCount(cap.id), 0);
});

test("favoriteCount 不会变负", async () => {
  const owner = await register();
  const fan = await register();
  const cap = await createCapsule(owner.accessToken);
  // 未收藏直接 DELETE 多次
  for (let i = 0; i < 3; i++) {
    await api("DELETE", `/api/v1/me/favorites/${cap.id}`, { token: fan.accessToken });
  }
  assert.equal(await favCount(cap.id), 0);
});

test("并发收藏：5 个账号并发点赞，总数仍为 5", async () => {
  const owner = await register();
  const cap = await createCapsule(owner.accessToken);
  const fans = await Promise.all(Array.from({ length: 5 }, () => register()));
  await Promise.all(
    fans.map((f) =>
      api("POST", "/api/v1/me/favorites", {
        token: f.accessToken,
        json: { capsuleId: cap.id },
      }),
    ),
  );
  assert.equal(await favCount(cap.id), 5);
});
