import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import type { FlowNode } from "@/lib/api";
import { server } from "@/test/handlers";
import { renderHookWithClient } from "@/test/render";
import { useFlows } from "./use-flows";

describe("useFlows", () => {
  it("returns the flow tree", async () => {
    const flows: FlowNode[] = [
      {
        id: "parent-1",
        name: "parent",
        queue: "emails",
        state: "waiting-children",
        children: [
          { id: "child-1", name: "child", queue: "emails", state: "completed", children: [] },
        ],
      },
    ];
    server.use(http.get("*/api/flows", () => HttpResponse.json(flows)));

    const { result } = renderHookWithClient(() => useFlows());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe("parent-1");
    expect(result.current.data?.[0].children[0].id).toBe("child-1");
  });
});
