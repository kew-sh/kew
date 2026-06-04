import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouteComponent,
} from "@tanstack/react-router";
import { lazy } from "react";
import type { ExtraRoute } from "./extensions";
import { AuthGate } from "./features/auth/auth-gate";
import { OverviewPage } from "./features/overview/overview-page";
import { AppShell } from "./shell/app-shell";
import { ErrorScreen } from "./shell/error-screen";

const JobsPage = lazy(() =>
  import("./features/jobs/jobs-page").then((m) => ({ default: m.JobsPage })),
);
const SchedulersPage = lazy(() =>
  import("./features/schedulers/schedulers-page").then((m) => ({ default: m.SchedulersPage })),
);
const FlowsPage = lazy(() =>
  import("./features/flows/flows-page").then((m) => ({ default: m.FlowsPage })),
);
const MetricsPage = lazy(() =>
  import("./features/metrics/metrics-page").then((m) => ({ default: m.MetricsPage })),
);

const rootRoute = createRootRoute({
  component: () => (
    <AuthGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthGate>
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

export function buildRouter(extraRoutes: ExtraRoute[] = []) {
  const extra = extraRoutes.map((r) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: r.path,
      component: r.component as RouteComponent,
    }),
  );
  const routeTree = rootRoute.addChildren([
    indexRoute,
    queueRoute,
    schedulersRoute,
    flowsRoute,
    metricsRoute,
    ...extra,
  ]);
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultErrorComponent: ErrorScreen,
  });
}

export type KewRouter = ReturnType<typeof buildRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: KewRouter;
  }
}
