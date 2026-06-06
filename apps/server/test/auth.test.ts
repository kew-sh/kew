import { beforeAll, describe, expect, test } from "bun:test";
import { redactRedisUrl } from "@kew/core/server";
import { Hono } from "hono";

process.env.KEW_AUTH_PASSWORD = "test-secret-xyz";
process.env.KEW_AUTH_EMAIL = "";
process.env.KEW_TRUST_PROXY_AUTH = "";

let app: Hono;

beforeAll(async () => {
  const auth = await import("../src/auth");
  app = new Hono();
  app.use("/api/*", auth.requireAuth);
  app.get("/api/auth/me", auth.handleMe);
  app.post("/api/auth/login", auth.handleLogin);
  app.post("/api/auth/logout", auth.handleLogout);
  app.get("/api/queues", (c) => c.json({ ok: true }));
});

describe("redactRedisUrl", () => {
  test("masks the password, leaves credential-free URLs intact", () => {
    expect(redactRedisUrl("redis://:secret@host:6379")).toBe("redis://:***@host:6379");
    expect(redactRedisUrl("redis://user:pw@h:6379/0")).toBe("redis://user:***@h:6379/0");
    expect(redactRedisUrl("rediss://default:abc@cloud:6380")).toBe(
      "rediss://default:***@cloud:6380",
    );
    expect(redactRedisUrl("redis://localhost:6379")).toBe("redis://localhost:6379");
  });

  test("masks passwords containing slashes and every node of a cluster URL", () => {
    expect(redactRedisUrl("redis://:p%2Fw@host:6379")).toBe("redis://:***@host:6379");
    expect(redactRedisUrl("redis://:pw@h1:6379,h2:6380")).toBe("redis://:***@h1:6379,h2:6380");
    expect(redactRedisUrl("redis://user:pw@h1:6379,redis://user:pw@h2:6380")).toBe(
      "redis://user:***@h1:6379,redis://user:***@h2:6380",
    );
    expect(redactRedisUrl("redis://user:pw@h1:6379,user:pw@h2:6380")).toBe(
      "redis://user:***@h1:6379,user:***@h2:6380",
    );
    expect(redactRedisUrl("redis://h:6379?password=secret")).toBe("redis://h:6379?password=***");
  });
});

describe("auth gate (password mode)", () => {
  test("rejects unauthenticated API calls", async () => {
    expect((await app.request("/api/queues")).status).toBe(401);
  });

  test("/api/auth/me advertises the gate without a session", async () => {
    const me = await (await app.request("/api/auth/me")).json();
    expect(me).toMatchObject({ authRequired: true, authenticated: false, mode: "password" });
  });

  test("rejects the wrong password", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "nope" }),
    });
    expect(res.status).toBe(401);
  });

  test("accepts the right password and issues a working session cookie", async () => {
    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "test-secret-xyz" }),
    });
    expect(login.status).toBe(204);
    const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(cookie).toContain("kew_session=");

    const ok = await app.request("/api/queues", { headers: { cookie } });
    expect(ok.status).toBe(200);
  });

  test("rate-limits a brute-force after 10 failures per IP", async () => {
    const ip = "203.0.113.7";
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ password: "wrong" }),
      });
      codes.push(res.status);
    }
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});
