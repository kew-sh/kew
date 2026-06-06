import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN =
  /(^|[^A-Za-z])(A?GPL|LGPL|SSPL|EUPL|OSL|CPAL|RPL|QPL|CDDL|SISSL|Commons-Clause|Prosperity|Parity|BUSL|CC-BY-NC|CC-BY-SA)([^A-Za-z]|$)/i;

function normalize(license) {
  if (!license) return "";
  if (typeof license === "string") return license;
  if (license.type) return license.type;
  return JSON.stringify(license);
}

function walk(dir, offenders) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === ".bin") continue;
    const path = join(dir, entry);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    if (entry.startsWith("@")) {
      walk(path, offenders);
      continue;
    }
    const manifest = join(path, "package.json");
    if (existsSync(manifest)) {
      try {
        const pkg = JSON.parse(readFileSync(manifest, "utf8"));
        const license = normalize(pkg.license || (pkg.licenses && pkg.licenses[0]));
        if (FORBIDDEN.test(license)) {
          offenders.push(`${pkg.name}@${pkg.version}: ${license}`);
        }
      } catch {}
    }
    const nested = join(path, "node_modules");
    if (existsSync(nested)) walk(nested, offenders);
  }
}

const nodeModules = join(process.cwd(), "node_modules");

if (!existsSync(nodeModules)) {
  console.error("node_modules not found — run `bun install` first.");
  process.exit(1);
}

const offenders = [];
walk(nodeModules, offenders);

if (offenders.length > 0) {
  console.error("Forbidden (copyleft / non-commercial) dependency licenses found:\n");
  for (const offender of [...new Set(offenders)].sort()) {
    console.error(`  ${offender}`);
  }
  console.error("\nThese licenses are incompatible with redistributing Kew under the FSL and with");
  console.error(
    "reusing community contributions in the proprietary cloud. Remove them before merging.",
  );
  process.exit(1);
}

console.log("OK: no copyleft or non-commercial dependency licenses found.");
