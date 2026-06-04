import { lazy } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AppShell } from "@/shell/app-shell";
import { OverviewPage } from "@/features/overview/overview-page";

// Overview is the landing route, kept eager. The rest are code-split so the
// initial bundle stays lean (TanStack Table, cronstrue, cron-parser, etc. load
// only when their route is visited). `defaultPreload: "intent"` prefetches the
// chunk on hover.
const JobsPage = lazy(() =>
  import("@/features/jobs/jobs-page").then((m) => ({ default: m.JobsPage })),
);
const SchedulersPage = lazy(() =>
  import("@/features/schedulers/schedulers-page").then((m) => ({ default: m.SchedulersPage })),
);
const FlowsPage = lazy(() =>
  import("@/features/flows/flows-page").then((m) => ({ default: m.FlowsPage })),
);
const MetricsPage = lazy(() =>
  import("@/features/metrics/metrics-page").then((m) => ({ default: m.MetricsPage })),
);

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage,
});

const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/queues/$queueName",
  component: JobsPage,
});

const schedulersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/schedulers",
  component: SchedulersPage,
});

const flowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/flows",
  component: FlowsPage,
});

const metricsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/metrics",
  component: MetricsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  queueRoute,
  schedulersRoute,
  flowsRoute,
  metricsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
