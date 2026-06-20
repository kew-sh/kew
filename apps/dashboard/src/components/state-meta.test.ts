import { describe, expect, it } from "vitest";
import { JOB_STATES } from "@/lib/api";
import { STATE_META } from "./state-meta";

describe("STATE_META", () => {
  it("covers every job state with a label, icon, and color tokens", () => {
    for (const state of JOB_STATES) {
      const meta = STATE_META[state];
      expect(meta, state).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.icon).toBeTypeOf("object");
      expect(meta.text).toMatch(/^text-/);
      expect(meta.bg).toMatch(/^bg-/);
      expect(meta.dot).toMatch(/^bg-/);
    }
  });

  it("has no entries beyond the known job states", () => {
    expect(Object.keys(STATE_META).sort()).toEqual([...JOB_STATES].sort());
  });
});
