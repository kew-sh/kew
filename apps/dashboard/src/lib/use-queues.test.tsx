import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { mkQueue, server } from "@/test/handlers";
import { renderHookWithClient } from "@/test/render";
import { useQueue, useQueues, useSetQueuePaused } from "./use-queues";

describe("useQueues", () => {
  it("returns the list of queues", async () => {
    server.use(
      http.get("*/api/queues", () => HttpResponse.json([mkQueue("emails"), mkQueue("webhooks")])),
    );

    const { result } = renderHookWithClient(() => useQueues());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((q) => q.name)).toEqual(["emails", "webhooks"]);
  });
});

describe("useQueue", () => {
  it("returns a single queue by name", async () => {
    server.use(
      http.get("*/api/queues/:name", ({ params }) =>
        HttpResponse.json(mkQueue(String(params.name), { paused: true })),
      ),
    );

    const { result } = renderHookWithClient(() => useQueue("emails"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("emails");
    expect(result.current.data?.paused).toBe(true);
  });
});

describe("useSetQueuePaused", () => {
  it("posts to /pause when pausing", async () => {
    const box: { path?: string } = {};
    server.use(
      http.post("*/api/queues/:name/pause", ({ request }) => {
        box.path = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHookWithClient(() => useSetQueuePaused());
    result.current.mutate({ queue: "emails", paused: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(box.path).toBe("/api/queues/emails/pause");
  });

  it("posts to /resume when resuming", async () => {
    const box: { path?: string } = {};
    server.use(
      http.post("*/api/queues/:name/resume", ({ request }) => {
        box.path = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHookWithClient(() => useSetQueuePaused());
    await result.current.mutateAsync({ queue: "emails", paused: false });

    expect(box.path).toBe("/api/queues/emails/resume");
  });
});
