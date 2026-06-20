import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { connectionInfo, mkQueue, server } from "@/test/handlers";
import { renderWithClient } from "@/test/render";
import { OverviewPage } from "./overview-page";

function renderOverview() {
  const rootRoute = createRootRoute({ component: OverviewPage });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return renderWithClient(<RouterProvider router={router} />);
}

describe("OverviewPage", () => {
  it("renders the queue list and the queue count", async () => {
    server.use(
      http.get("*/api/queues", () =>
        HttpResponse.json([mkQueue("emails"), mkQueue("webhooks"), mkQueue("billing")]),
      ),
    );

    const { findByText, getByText } = renderOverview();
    expect(await findByText("emails")).toBeInTheDocument();
    expect(getByText("webhooks")).toBeInTheDocument();
    expect(getByText("billing")).toBeInTheDocument();
    expect(getByText("3 queues")).toBeInTheDocument();
  });

  it("switches the Sort mode via the Sort buttons", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/queues", () => HttpResponse.json([mkQueue("alpha"), mkQueue("beta")])),
    );

    const { findByRole, getByRole } = renderOverview();

    const health = await findByRole("button", { name: "Health" });
    const backlog = getByRole("button", { name: "Backlog" });
    const name = getByRole("button", { name: "Name" });

    expect(health).toHaveAttribute("aria-pressed", "true");
    expect(backlog).toHaveAttribute("aria-pressed", "false");

    await user.click(backlog);
    expect(backlog).toHaveAttribute("aria-pressed", "true");
    expect(health).toHaveAttribute("aria-pressed", "false");

    await user.click(name);
    expect(name).toHaveAttribute("aria-pressed", "true");
    expect(backlog).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the empty state when there are no queues", async () => {
    server.use(http.get("*/api/queues", () => HttpResponse.json([])));

    const { findByText } = renderOverview();
    expect(await findByText(/no queues found on this redis/i)).toBeInTheDocument();
  });

  it("shows the disconnected state when the connection is in error", async () => {
    server.use(
      http.get("*/api/connection", () => HttpResponse.json({ ...connectionInfo, status: "error" })),
      http.get("*/api/queues", () => HttpResponse.json([mkQueue("emails")])),
    );

    const { findByText, queryByText } = renderOverview();
    expect(await findByText(/can.t reach redis/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Disconnected")).toBeInTheDocument());
    expect(queryByText("emails")).not.toBeInTheDocument();
  });
});
