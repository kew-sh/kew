import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api } from "@/lib/api";
import {
  authInfo,
  connectionInfo,
  mkJob,
  mkPage,
  mkQueue,
  scheduler,
  server,
  versionInfo,
} from "@/test/handlers";

interface Captured {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
}

function capture(method: "get" | "post" | "delete", pattern: string, status = 204, json?: unknown) {
  const box: { req?: Captured } = {};
  server.use(
    http[method](pattern, async ({ request }) => {
      const url = new URL(request.url);
      let body: unknown;
      try {
        body = await request.clone().json();
      } catch {
        body = undefined;
      }
      box.req = { method: request.method, path: url.pathname, search: url.searchParams, body };
      return json === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(json);
    }),
  );
  return box;
}

describe("httpApi reads", () => {
  it("getAuth → GET /api/auth/me", async () => {
    const box = capture("get", "*/api/auth/me", 200, authInfo);
    expect(await api.getAuth()).toEqual(authInfo);
    expect(box.req?.path).toBe("/api/auth/me");
  });

  it("getConnection → GET /api/connection", async () => {
    capture("get", "*/api/connection", 200, connectionInfo);
    expect(await api.getConnection()).toEqual(connectionInfo);
  });

  it("getVersion → GET /api/version", async () => {
    capture("get", "*/api/version", 200, versionInfo);
    expect(await api.getVersion()).toEqual(versionInfo);
  });

  it("listQueues → GET /api/queues", async () => {
    const queues = [mkQueue("emails"), mkQueue("webhooks")];
    capture("get", "*/api/queues", 200, queues);
    expect((await api.listQueues()).map((q) => q.name)).toEqual(["emails", "webhooks"]);
  });

  it("getQueue url-encodes the queue name", async () => {
    const box = capture("get", "*/api/queues/:name", 200, mkQueue("a/b"));
    await api.getQueue("a/b");
    expect(box.req?.path).toBe("/api/queues/a%2Fb");
  });

  it("getJobs sends state, page, pageSize and search as query params", async () => {
    const box = capture("get", "*/api/queues/:name/jobs", 200, mkPage([mkJob("1")]));
    const page = await api.getJobs({
      queue: "emails",
      state: "failed",
      page: 2,
      pageSize: 50,
      search: "alice",
    });
    expect(page.jobs[0].id).toBe("1");
    expect(box.req?.path).toBe("/api/queues/emails/jobs");
    expect(box.req?.search.get("state")).toBe("failed");
    expect(box.req?.search.get("page")).toBe("2");
    expect(box.req?.search.get("pageSize")).toBe("50");
    expect(box.req?.search.get("search")).toBe("alice");
  });

  it("getHistory forwards every filter", async () => {
    const box = capture("get", "*/api/history", 200, mkPage([]));
    await api.getHistory({
      queue: "emails",
      state: "completed",
      from: 1,
      to: 2,
      page: 0,
      pageSize: 10,
    });
    expect(box.req?.search.get("queue")).toBe("emails");
    expect(box.req?.search.get("state")).toBe("completed");
    expect(box.req?.search.get("from")).toBe("1");
    expect(box.req?.search.get("to")).toBe("2");
  });

  it("listSchedulers → GET /api/queues/:name/schedulers", async () => {
    capture("get", "*/api/queues/:name/schedulers", 200, [scheduler]);
    expect((await api.listSchedulers("emails"))[0].id).toBe("nightly");
  });

  it("listFlows → GET /api/flows", async () => {
    capture("get", "*/api/flows", 200, []);
    expect(await api.listFlows()).toEqual([]);
  });
});

describe("httpApi writes", () => {
  it("login posts the credentials", async () => {
    const box = capture("post", "*/api/auth/login");
    await api.login({ email: "a@b.com", password: "pw" });
    expect(box.req?.method).toBe("POST");
    expect(box.req?.body).toEqual({ email: "a@b.com", password: "pw" });
  });

  it("logout posts to /api/auth/logout", async () => {
    const box = capture("post", "*/api/auth/logout");
    await api.logout();
    expect(box.req?.path).toBe("/api/auth/logout");
  });

  it("setQueuePaused hits /pause when paused", async () => {
    const box = capture("post", "*/api/queues/:name/pause");
    await api.setQueuePaused({ queue: "emails", paused: true });
    expect(box.req?.path).toBe("/api/queues/emails/pause");
  });

  it("setQueuePaused hits /resume when not paused", async () => {
    const box = capture("post", "*/api/queues/:name/resume");
    await api.setQueuePaused({ queue: "emails", paused: false });
    expect(box.req?.path).toBe("/api/queues/emails/resume");
  });

  it("bulkAction posts ids + action and returns the affected count", async () => {
    const box = capture("post", "*/api/queues/:name/jobs/bulk", 200, { affected: 2 });
    const res = await api.bulkAction({ queue: "emails", ids: ["1", "2"], action: "retry" });
    expect(res.affected).toBe(2);
    expect(box.req?.body).toEqual({ ids: ["1", "2"], action: "retry" });
  });

  it("retryWithData posts the edited payload", async () => {
    const box = capture("post", "*/api/queues/:name/jobs/:id/retry-with-data");
    await api.retryWithData({ queue: "emails", id: "7", data: { fixed: true } });
    expect(box.req?.path).toBe("/api/queues/emails/jobs/7/retry-with-data");
    expect(box.req?.body).toEqual({ data: { fixed: true } });
  });

  it("rerun posts the data and returns the new id", async () => {
    const box = capture("post", "*/api/queues/:name/jobs/:id/rerun", 200, { id: "99" });
    const res = await api.rerun({ queue: "emails", id: "7", data: { x: 1 } });
    expect(res.id).toBe("99");
    expect(box.req?.body).toEqual({ data: { x: 1 } });
  });

  it("rerun without data sends no body", async () => {
    const box = capture("post", "*/api/queues/:name/jobs/:id/rerun", 200, { id: "99" });
    await api.rerun({ queue: "emails", id: "7" });
    expect(box.req?.body).toBeUndefined();
  });

  it("upsertScheduler posts the scheduler input", async () => {
    const box = capture("post", "*/api/queues/:name/schedulers");
    await api.upsertScheduler({
      queue: "emails",
      id: "nightly",
      name: "report",
      pattern: "0 0 * * *",
    });
    expect(box.req?.body).toMatchObject({ id: "nightly", pattern: "0 0 * * *" });
  });

  it("removeScheduler deletes by id", async () => {
    const box = capture("delete", "*/api/queues/:name/schedulers/:id");
    await api.removeScheduler({ queue: "emails", id: "nightly" });
    expect(box.req?.method).toBe("DELETE");
    expect(box.req?.path).toBe("/api/queues/emails/schedulers/nightly");
  });
});
