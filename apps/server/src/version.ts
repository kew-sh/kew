import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "./env";
import type { VersionInfo } from "./types";

const CURRENT = readCurrentVersion();
const CHECK = env.KEW_UPDATE_CHECK;
const REPO = "kew-sh/kew";
const TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 3000;
const SEMVER = /^v?\d+\.\d+\.\d+$/;

let cache: { at: number; latest?: string } | null = null;

function readCurrentVersion(): string {
  try {
    const path = fileURLToPath(new URL("../../../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
    return pkg.version || "dev";
  } catch {
    return "dev";
  }
}

function parts(v: string): [number, number, number] {
  const [a, b, c] = v
    .replace(/^v/, "")
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
  return [a ?? 0, b ?? 0, c ?? 0];
}

function isNewer(latest: string, current: string): boolean {
  if (!SEMVER.test(latest) || !SEMVER.test(current)) return false;
  const [la, lb, lc] = parts(latest);
  const [ca, cb, cc] = parts(current);
  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  return lc > cc;
}

async function fetchLatest(): Promise<string | undefined> {
  if (!CHECK) return undefined;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.latest;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latest = res.ok ? ((await res.json()) as { tag_name?: string }).tag_name : cache?.latest;
    cache = { at: Date.now(), latest };
    return latest;
  } catch {
    cache = { at: Date.now(), latest: cache?.latest };
    return cache.latest;
  }
}

export async function getVersionInfo(): Promise<VersionInfo> {
  const latest = await fetchLatest();
  return {
    current: CURRENT,
    latest,
    updateAvailable: Boolean(latest && isNewer(latest, CURRENT)),
  };
}
