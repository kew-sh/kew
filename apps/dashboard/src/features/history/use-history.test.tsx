import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { mkJob, mkPage, server } from "@/test/handlers";
import { renderHookWithClient } from "@/test/render";
import { useHistory } from "./use-history";

describe("useHistory", () => {
  it("returns a page of historical jobs and forwards every filter", async () => {
    const box: { search?: URLSearchParams } = {};
    server.use(
      http.get("*/api/history", ({ request }) => {
        box.search = new URL(request.url).searchParams;
        return HttpResponse.json(mkPage([mkJob("1", { state: "completed" })], { total: 1 }));
      }),
    );

    const { result } = renderHookWithClient(() =>
      useHistory({
        queue: "emails",
        state: "completed",
        from: 1,
        to: 2,
        search: "bob",
        page: 0,
        pageSize: 10,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.jobs[0].id).toBe("1");
    expect(box.search?.get("queue")).toBe("emails");
    expect(box.search?.get("state")).toBe("completed");
    expect(box.search?.get("from")).toBe("1");
    expect(box.search?.get("to")).toBe("2");
    expect(box.search?.get("search")).toBe("bob");
  });
});
