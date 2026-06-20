import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { scheduler, server } from "@/test/handlers";
import { renderHookWithClient } from "@/test/render";
import { useRemoveScheduler, useSchedulers, useUpsertScheduler } from "./use-schedulers";

describe("useSchedulers", () => {
  it("returns the schedulers for a queue", async () => {
    server.use(http.get("*/api/queues/:name/schedulers", () => HttpResponse.json([scheduler])));

    const { result } = renderHookWithClient(() => useSchedulers("emails"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe("nightly");
  });
});

describe("useUpsertScheduler", () => {
  it("posts the scheduler input", async () => {
    const box: { body?: unknown; path?: string } = {};
    server.use(
      http.post("*/api/queues/:name/schedulers", async ({ request }) => {
        box.path = new URL(request.url).pathname;
        box.body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHookWithClient(() => useUpsertScheduler("emails"));
    await result.current.mutateAsync({
      queue: "emails",
      id: "nightly",
      name: "report",
      pattern: "0 0 * * *",
    });

    expect(box.path).toBe("/api/queues/emails/schedulers");
    expect(box.body).toMatchObject({ id: "nightly", pattern: "0 0 * * *" });
  });
});

describe("useRemoveScheduler", () => {
  it("deletes the scheduler by id", async () => {
    const box: { path?: string; method?: string } = {};
    server.use(
      http.delete("*/api/queues/:name/schedulers/:id", ({ request }) => {
        const url = new URL(request.url);
        box.path = url.pathname;
        box.method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHookWithClient(() => useRemoveScheduler("emails"));
    await result.current.mutateAsync("nightly");

    expect(box.method).toBe("DELETE");
    expect(box.path).toBe("/api/queues/emails/schedulers/nightly");
  });
});
