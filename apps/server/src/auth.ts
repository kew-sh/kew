import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/bun";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { env } from "./env";
import type { AuthInfo } from "./types";

const PASSWORD = env.KEW_AUTH_PASSWORD;
const EMAIL = env.KEW_AUTH_EMAIL;
const TRUST_PROXY = env.KEW_TRUST_PROXY_AUTH;
const PROXY_HEADER = env.KEW_PROXY_USER_HEADER;
const HOPS = env.KEW_TRUSTED_PROXY_HOPS;
const SIGNING_KEY =
  env.KEW_SESSION_SECRET ??
  (PASSWORD ? createHash("sha256").update(`kew-session::${PASSWORD}`).digest("hex") : "");

const COOKIE = "kew_session";
const TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60_000;
const MAX_ATTEMPT_KEYS = 10_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function pruneAttempts(now: number): void {
  if (attempts.size <= MAX_ATTEMPT_KEYS) return;
  for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
  while (attempts.size > MAX_ATTEMPT_KEYS) {
    const oldest = attempts.keys().next().value;
    if (oldest === undefined) break;
    attempts.delete(oldest);
  }
}

export const AUTH_MODE: AuthInfo["mode"] = TRUST_PROXY ? "proxy" : PASSWORD ? "password" : "none";

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function isHttps(c: Context): boolean {
  const proto = c.req.header("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(c.req.url).protocol === "https:";
  } catch {
    return false;
  }
}

function clientIp(c: Context): string {
  if (TRUST_PROXY || HOPS > 0) {
    const xff = c.req.header("x-forwarded-for");
    if (xff) {
      const parts = xff
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const hops = HOPS > 0 ? HOPS : 1;
      const idx = parts.length - hops;
      if (idx >= 0 && parts[idx]) return parts[idx];
      if (parts.length > 0) return parts[0];
    }
    const real = c.req.header("x-real-ip");
    if (real) return real;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

function proxyUser(c: Context): string | undefined {
  return TRUST_PROXY ? c.req.header(PROXY_HEADER) || undefined : undefined;
}

async function sessionUser(c: Context): Promise<string | undefined> {
  const raw = getCookie(c, COOKIE);
  if (!raw || !SIGNING_KEY) return undefined;
  try {
    const payload = await verify(raw, SIGNING_KEY, "HS256");
    return (payload.sub as string) || "user";
  } catch {
    return undefined;
  }
}

async function currentUser(c: Context): Promise<string | undefined> {
  return proxyUser(c) ?? (await sessionUser(c));
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (AUTH_MODE === "none") return next();
  if (c.req.path.startsWith("/api/auth/")) return next();
  if (await currentUser(c)) return next();
  return c.json({ error: "unauthorized" }, 401);
};

export async function handleMe(c: Context) {
  const user = await currentUser(c);
  const info: AuthInfo = {
    authRequired: AUTH_MODE !== "none",
    authenticated: AUTH_MODE === "none" || Boolean(user),
    mode: AUTH_MODE,
    requiresUser: AUTH_MODE === "password" && Boolean(EMAIL),
    user,
  };
  return c.json(info);
}

export async function handleLogin(c: Context) {
  if (AUTH_MODE !== "password") return c.json({ error: "password login disabled" }, 400);

  const key = clientIp(c);
  const now = Date.now();
  const slot = attempts.get(key);
  if (slot && now < slot.resetAt && slot.count >= MAX_ATTEMPTS) {
    return c.json({ error: "too many attempts" }, 429, { "retry-after": "60" });
  }

  const body = await c.req
    .json<{ email?: string; password?: string }>()
    .catch(() => ({}) as { email?: string; password?: string });
  const okPassword = Boolean(body.password) && safeEqual(body.password as string, PASSWORD);
  const okEmail = !EMAIL || safeEqual((body.email ?? "").trim().toLowerCase(), EMAIL.toLowerCase());
  if (!okPassword || !okEmail) {
    if (slot && now < slot.resetAt) {
      slot.count += 1;
    } else {
      pruneAttempts(now);
      attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    }
    return c.json({ error: "invalid credentials" }, 401);
  }

  attempts.delete(key);
  const iat = Math.floor(now / 1000);
  const token = await sign({ sub: EMAIL ?? "kew", iat, exp: iat + TTL_SECONDS }, SIGNING_KEY);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isHttps(c),
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return c.body(null, 204);
}

export function handleLogout(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
  return c.body(null, 204);
}
