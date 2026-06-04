import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AppShell } from "@/shell/app-shell";
import { OverviewPage } from "@/features/overview/overview-page";
import { JobsPage } from "@/features/jobs/jobs-page";
import { SchedulersPage } from "@/features/schedulers/schedulers-page";

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

const routeTree = rootRoute.addChildren([indexRoute, queueRoute, schedulersRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
