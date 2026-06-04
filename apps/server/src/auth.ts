import { createHash, timingSafeEqual } from "node:crypto";
import type { AuthInfo } from "@kew/core/types";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

const TOKEN = process.env.KEW_AUTH_TOKEN ?? "";
const USER = process.env.KEW_AUTH_USER || undefined;
const TRUST_PROXY = process.env.KEW_TRUST_PROXY_AUTH === "1";
const PROXY_HEADER = (process.env.KEW_PROXY_USER_HEADER ?? "x-forwarded-user").toLowerCase();
const SIGNING_KEY =
  process.env.KEW_SESSION_SECRET ||
  (TOKEN ? createHash("sha256").update(`kew-session::${TOKEN}`).digest("hex") : "");

const COOKIE = "kew_session";
const TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

export const AUTH_MODE: AuthInfo["mode"] = TRUST_PROXY ? "proxy" : TOKEN ? "password" : "none";

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
    requiresUser: AUTH_MODE === "password" && Boolean(USER),
    user,
  };
  return c.json(info);
}

function rateKey(c: Context): string {
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return c.req.header("x-real-ip") ?? "local";
}

export async function handleLogin(c: Context) {
  if (AUTH_MODE !== "password") return c.json({ error: "password login disabled" }, 400);

  const key = rateKey(c);
  const now = Date.now();
  const slot = attempts.get(key);
  if (slot && now < slot.resetAt && slot.count >= MAX_ATTEMPTS) {
    return c.json({ error: "too many attempts" }, 429, { "retry-after": "60" });
  }

  const body = await c.req
    .json<{ email?: string; password?: string }>()
    .catch(() => ({}) as { email?: string; password?: string });
  const okPassword = Boolean(body.password) && safeEqual(body.password as string, TOKEN);
  const okEmail = !USER || safeEqual((body.email ?? "").trim().toLowerCase(), USER.toLowerCase());
  if (!okPassword || !okEmail) {
    if (slot && now < slot.resetAt) slot.count += 1;
    else attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return c.json({ error: "invalid credentials" }, 401);
  }

  attempts.delete(key);
  const iat = Math.floor(now / 1000);
  const token = await sign({ sub: USER ?? "kew", iat, exp: iat + TTL_SECONDS }, SIGNING_KEY);
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
