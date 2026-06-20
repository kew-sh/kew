import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import type { QueueSummary } from "@/lib/api";
import { mkQueue } from "@/test/handlers";
import { renderWithClient } from "@/test/render";
import { QueueRow } from "./queue-row";

function renderRow(q: QueueSummary) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <QueueRow q={q} />,
  });
  const queueRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/queues/$queueName",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, queueRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return renderWithClient(<RouterProvider router={router} />);
}

describe("QueueRow", () => {
  it("renders the queue name as a link to the queue detail route", async () => {
    const { findByText, getByRole } = renderRow(mkQueue("emails"));
    expect(await findByText("emails")).toBeInTheDocument();

    const link = getByRole("link");
    expect(link).toHaveAttribute("href", "/queues/emails");
  });

  it("renders the per-state counts (compacted)", async () => {
    const q = mkQueue("billing", {
      counts: {
        active: 2,
        waiting: 5,
        prioritized: 0,
        delayed: 1,
        "waiting-children": 0,
        completed: 1200,
        failed: 3,
        paused: 0,
      },
      ratePerMin: 42,
    });

    const { findByText, getByText, getAllByText } = renderRow(q);
    expect(await findByText("billing")).toBeInTheDocument();
    expect(getAllByText("2").length).toBeGreaterThan(0);
    expect(getByText("5")).toBeInTheDocument();
    expect(getAllByText("3").length).toBeGreaterThan(0);
    expect(getByText("1.2k")).toBeInTheDocument();
    expect(getByText("42")).toBeInTheDocument();
  });

  it("shows a paused badge for a paused queue", async () => {
    const { findByText, getByText } = renderRow(mkQueue("stale", { paused: true }));
    expect(await findByText("stale")).toBeInTheDocument();
    expect(getByText("paused")).toBeInTheDocument();
  });
});
