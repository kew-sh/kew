import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectionInfo, mkJob, mkPage, mkQueue, server } from "@/test/handlers";
import { createWrapper } from "@/test/render";
import { JobsPage } from "./jobs-page";

const ELEMENT_HEIGHT = 600;
const originals: {
  height?: PropertyDescriptor;
  rect?: typeof Element.prototype.getBoundingClientRect;
} = {};

beforeAll(() => {
  originals.height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  originals.rect = Element.prototype.getBoundingClientRect;
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return ELEMENT_HEIGHT;
    },
  });
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      width: 800,
      height: ELEMENT_HEIGHT,
      top: 0,
      left: 0,
      bottom: ELEMENT_HEIGHT,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

afterAll(() => {
  if (originals.height) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originals.height);
  }
  if (originals.rect) {
    Element.prototype.getBoundingClientRect = originals.rect;
  }
});

function renderJobsPage(queueName = "emails") {
  const { client } = createWrapper();

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <Outlet />
      </QueryClientProvider>
    ),
  });
  const queueRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/queues/$queueName",
    component: JobsPage,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const routeTree = rootRoute.addChildren([queueRoute, indexRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/queues/${queueName}`] }),
  });

  return render(<RouterProvider router={router} />);
}

describe("JobsPage", () => {
  it("renders the queue name and the state tabs", async () => {
    server.use(
      http.get("*/api/connection", () => HttpResponse.json(connectionInfo)),
      http.get("*/api/queues/:name", ({ params }) =>
        HttpResponse.json(
          mkQueue(String(params.name), { counts: { ...mkQueue("x").counts, completed: 3 } }),
        ),
      ),
      http.get("*/api/queues/:name/jobs", () =>
        HttpResponse.json(mkPage([mkJob("1", { name: "alpha" }), mkJob("2", { name: "beta" })])),
      ),
    );

    renderJobsPage("emails");

    expect(await screen.findByText("emails")).toBeInTheDocument();

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(8);
    expect(screen.getByRole("tab", { name: /Completed/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Failed/ })).toBeInTheDocument();
  });

  it("renders jobs from the jobs endpoint and reflects the shown count", async () => {
    server.use(
      http.get("*/api/connection", () => HttpResponse.json(connectionInfo)),
      http.get("*/api/queues/:name", ({ params }) =>
        HttpResponse.json(mkQueue(String(params.name))),
      ),
      http.get("*/api/queues/:name/jobs", () =>
        HttpResponse.json(mkPage([mkJob("1", { name: "alpha" }), mkJob("2", { name: "beta" })])),
      ),
    );

    renderJobsPage("emails");

    expect(await screen.findByText("alpha")).toBeInTheDocument();
    expect(await screen.findByText("beta")).toBeInTheDocument();
    expect(screen.getByText(/^1.2 of 2$/, { selector: "span" })).toBeInTheDocument();
  });

  it("paginates: clicking Next requests the following page", async () => {
    const pages: string[] = [];
    server.use(
      http.get("*/api/connection", () => HttpResponse.json(connectionInfo)),
      http.get("*/api/queues/:name", ({ params }) =>
        HttpResponse.json(mkQueue(String(params.name))),
      ),
      http.get("*/api/queues/:name/jobs", ({ request }) => {
        const p = new URL(request.url).searchParams.get("page") ?? "0";
        pages.push(p);
        return HttpResponse.json(mkPage([mkJob(`p${p}`, { name: `job-${p}` })], { total: 250 }));
      }),
    );

    const user = userEvent.setup();
    renderJobsPage("emails");

    expect(await screen.findByText("job-0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next page/ }));

    await waitFor(() => expect(pages).toContain("1"));
    expect(await screen.findByText("job-1")).toBeInTheDocument();
  });

  it("typing in the search box triggers a new jobs request carrying the search term", async () => {
    const searches: string[] = [];
    server.use(
      http.get("*/api/connection", () => HttpResponse.json(connectionInfo)),
      http.get("*/api/queues/:name", ({ params }) =>
        HttpResponse.json(mkQueue(String(params.name))),
      ),
      http.get("*/api/queues/:name/jobs", ({ request }) => {
        const s = new URL(request.url).searchParams.get("search");
        if (s) searches.push(s);
        const jobs = s === "alpha" ? [mkJob("1", { name: "alpha" })] : [];
        return HttpResponse.json(mkPage(jobs));
      }),
    );

    const user = userEvent.setup();
    renderJobsPage("emails");

    const input = await screen.findByRole("textbox", { name: /Search jobs/ });
    await user.type(input, "alpha");

    await waitFor(() => expect(searches).toContain("alpha"));
    expect(await screen.findByText("alpha")).toBeInTheDocument();
  });

  it("clicking a state tab switches the active state and requests that state", async () => {
    const requestedStates: string[] = [];
    server.use(
      http.get("*/api/connection", () => HttpResponse.json(connectionInfo)),
      http.get("*/api/queues/:name", ({ params }) =>
        HttpResponse.json(mkQueue(String(params.name))),
      ),
      http.get("*/api/queues/:name/jobs", ({ request }) => {
        const state = new URL(request.url).searchParams.get("state") ?? "";
        requestedStates.push(state);
        return HttpResponse.json(mkPage([]));
      }),
    );

    const user = userEvent.setup();
    renderJobsPage("emails");

    const completedTab = await screen.findByRole("tab", { name: /Completed/ });
    expect(completedTab).toHaveAttribute("aria-selected", "true");

    const failedTab = screen.getByRole("tab", { name: /Failed/ });
    await user.click(failedTab);

    expect(failedTab).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(requestedStates).toContain("failed"));
  });
});
