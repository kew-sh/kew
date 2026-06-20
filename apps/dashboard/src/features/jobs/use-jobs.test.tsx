import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { mkJob, mkPage, server } from "@/test/handlers";
import { renderHookWithClient } from "@/test/render";
import { useBulkAction, useJobAction, useJobs, useRerun, useRetryWithData } from "./use-jobs";

const query = {
  queue: "emails",
  state: "failed",
  page: 0,
  pageSize: 25,
} as const;

describe("useJobs", () => {
  it("returns a page of jobs and forwards filters as query params", async () => {
    const box: { search?: URLSearchParams; path?: string } = {};
    server.use(
      http.get("*/api/queues/:name/jobs", ({ request }) => {
        const url = new URL(request.url);
        box.path = url.pathname;
        box.search = url.searchParams;
        return HttpResponse.json(mkPage([mkJob("1"), mkJob("2")], { total: 2 }));
      }),
    );

    const { result } = renderHookWithClient(() => useJobs({ ...query, search: "alice" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.jobs.map((j) => j.id)).toEqual(["1", "2"]);
    expect(result.current.data?.total).toBe(2);
    expect(box.path).toBe("/api/queues/emails/jobs");
    expect(box.search?.get("state")).toBe("failed");
    expect(box.search?.get("search")).toBe("alice");
  });
});

describe("useBulkAction", () => {
  it("posts ids + action and returns the affected count", async () => {
    const box: { body?: unknown; path?: string } = {};
    server.use(
      http.post("*/api/queues/:name/jobs/bulk", async ({ request }) => {
        box.path = new URL(request.url).pathname;
        box.body = await request.json();
        return HttpResponse.json({ affected: 2 });
      }),
    );

    const { result } = renderHookWithClient(() => useBulkAction("emails"));
    result.current.mutate({ ids: ["1", "2"], action: "retry" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.affected).toBe(2);
    expect(box.path).toBe("/api/queues/emails/jobs/bulk");
    expect(box.body).toEqual({ ids: ["1", "2"], action: "retry" });
  });
});

describe("useJobAction", () => {
  it("wraps a single id into a bulk action", async () => {
    const box: { body?: unknown } = {};
    server.use(
      http.post("*/api/queues/:name/jobs/bulk", async ({ request }) => {
        box.body = await request.json();
        return HttpResponse.json({ affected: 1 });
      }),
    );

    const { result } = renderHookWithClient(() => useJobAction("emails"));
    await result.current.mutateAsync({ id: "7", action: "remove" });

    expect(box.body).toEqual({ ids: ["7"], action: "remove" });
  });
});

describe("useRetryWithData", () => {
  it("posts the edited payload to retry-with-data", async () => {
    const box: { body?: unknown; path?: string } = {};
    server.use(
      http.post("*/api/queues/:name/jobs/:id/retry-with-data", async ({ request }) => {
        box.path = new URL(request.url).pathname;
        box.body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHookWithClient(() => useRetryWithData("emails"));
    await result.current.mutateAsync({ id: "7", data: { fixed: true } });

    expect(box.path).toBe("/api/queues/emails/jobs/7/retry-with-data");
    expect(box.body).toEqual({ data: { fixed: true } });
  });
});

describe("useRerun", () => {
  it("posts the data and returns the new job id", async () => {
    const box: { body?: unknown } = {};
    server.use(
      http.post("*/api/queues/:name/jobs/:id/rerun", async ({ request }) => {
        box.body = await request
          .clone()
          .json()
          .catch(() => undefined);
        return HttpResponse.json({ id: "99" });
      }),
    );

    const { result } = renderHookWithClient(() => useRerun("emails"));
    result.current.mutate({ id: "7", data: { x: 1 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("99");
    expect(box.body).toEqual({ data: { x: 1 } });
  });
});
