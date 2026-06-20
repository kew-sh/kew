import { describe, expect, it } from "vitest";
import { cn, compact, duration, relativeTime } from "./utils";

describe("cn", () => {
  it("merges classes and lets later Tailwind utilities win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false, undefined, "font-bold")).toBe("text-sm font-bold");
  });
});

describe("compact", () => {
  it("leaves values under 1000 untouched", () => {
    expect(compact(0)).toBe("0");
    expect(compact(999)).toBe("999");
  });

  it("formats thousands with one decimal, trimming a trailing .0", () => {
    expect(compact(1000)).toBe("1k");
    expect(compact(1234)).toBe("1.2k");
    expect(compact(12_000)).toBe("12k");
  });

  it("formats millions", () => {
    expect(compact(1_500_000)).toBe("1.5M");
  });
});

describe("relativeTime", () => {
  const now = 1_000_000_000_000;
  it("renders seconds, minutes, hours, and days", () => {
    expect(relativeTime(now - 5_000, now)).toBe("5s");
    expect(relativeTime(now - 4 * 60_000, now)).toBe("4m");
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe("3h");
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe("2d");
  });

  it("clamps a future timestamp to 0s", () => {
    expect(relativeTime(now + 5_000, now)).toBe("0s");
  });
});

describe("duration", () => {
  it("renders milliseconds under a second", () => {
    expect(duration(850)).toBe("850ms");
  });

  it("renders seconds with one decimal", () => {
    expect(duration(4200)).toBe("4.2s");
  });

  it("renders minutes and zero-padded seconds", () => {
    expect(duration(92_000)).toBe("1m32s");
  });
});
