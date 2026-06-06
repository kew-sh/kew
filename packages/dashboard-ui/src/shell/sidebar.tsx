import { type QueueSummary, queueHealth } from "@kew/core";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUp, BarChart3, CalendarClock, GitFork, History, ListChecks } from "lucide-react";
import { KewMark } from "../components/brand";
import { StateDot } from "../components/state-badge";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  Sidebar as SidebarRoot,
  useSidebar,
} from "../components/ui/sidebar";
import { Slot } from "../extensions";
import { useConnection } from "../lib/use-connection";
import { useQueues } from "../lib/use-queues";
import { useVersion } from "../lib/use-version";
import { compact } from "../lib/utils";

const NAV = [
  { to: "/", icon: ListChecks, label: "Overview" },
  { to: "/schedulers", icon: CalendarClock, label: "Schedulers" },
  { to: "/flows", icon: GitFork, label: "Flows" },
  { to: "/metrics", icon: BarChart3, label: "Metrics" },
  { to: "/history", icon: History, label: "History" },
] as const;

export function Sidebar() {
  const { data: queues } = useQueues();
  const { data: conn } = useConnection();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);

  return (
    <SidebarRoot collapsible="icon">
      <SidebarHeader className="h-14 justify-center">
        <div className="flex items-center gap-2.5 px-1">
          <KewMark className="size-7 shrink-0" />
          <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Kew
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.label}>
                  <Link to={item.to} onClick={close}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <Slot name="sidebar.nav.extra" />
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-1 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Queues</SidebarGroupLabel>
          <SidebarGroupContent className="min-h-0 flex-1 overflow-y-auto">
            <SidebarMenu>
              {queues?.map((q) => (
                <QueueLink
                  key={q.name}
                  q={q}
                  active={pathname === `/queues/${q.name}`}
                  onNavigate={close}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <Slot name="sidebar.footer" />
        <div className="space-y-2 px-1">
          <div className="flex items-center gap-2 text-xs">
            <StateDot
              state={conn?.status === "connected" ? "completed" : "failed"}
              pulse={conn?.status === "connected"}
            />
            <span className="min-w-0 flex-1 truncate font-mono text-muted">
              {conn?.url ?? "connecting…"}
            </span>
            {conn && <span className="font-mono text-[10px] text-muted">v{conn.redisVersion}</span>}
          </div>
          <KewVersion />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  );
}

function QueueLink({
  q,
  active,
  onNavigate,
}: {
  q: QueueSummary;
  active: boolean;
  onNavigate: () => void;
}) {
  const health = queueHealth(q);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={q.name}>
        <Link to="/queues/$queueName" params={{ queueName: q.name }} onClick={onNavigate}>
          <StateDot state={health} pulse={health === "active"} />
          <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{q.name}</span>
        </Link>
      </SidebarMenuButton>
      {q.counts.failed > 0 && (
        <SidebarMenuBadge className="tnum text-failed">{compact(q.counts.failed)}</SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

function KewVersion() {
  const { data } = useVersion();
  if (!data) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] text-muted">
      <span className="font-mono">Kew</span>
      {data.updateAvailable && data.latest ? (
        <a
          href="https://github.com/kew-sh/kew/releases/latest"
          target="_blank"
          rel="noreferrer"
          title={`${data.latest} available (you have v${data.current})`}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent transition-colors hover:bg-accent/25"
        >
          <ArrowUp className="size-3" />
          Update available
        </a>
      ) : (
        <span className="font-mono">v{data.current}</span>
      )}
    </div>
  );
}
