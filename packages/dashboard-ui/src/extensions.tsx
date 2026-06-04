import type { Job, QueueSummary } from "@kew/core";
import { type ComponentType, createContext, useContext } from "react";

export type QueueContext = {
  queueName: string;
  queue: QueueSummary | undefined;
  readOnly: boolean;
};

export type OverviewContext = {
  queues: QueueSummary[] | undefined;
};

export type JobDrawerContext = {
  job: Job;
  readOnly: boolean;
};

export type SlotComponents = {
  "topbar.actions": ComponentType;
  "sidebar.nav.extra": ComponentType;
  "sidebar.footer": ComponentType;
  "overview.header.actions": ComponentType<{ ctx: OverviewContext }>;
  "overview.below-list": ComponentType<{ ctx: OverviewContext }>;
  "queue.toolbar": ComponentType<{ ctx: QueueContext }>;
  "queue.above-table": ComponentType<{ ctx: QueueContext }>;
  "job-drawer.footer": ComponentType<{ ctx: JobDrawerContext }>;
};

export type SlotName = keyof SlotComponents;
export type SlotMap = Partial<SlotComponents>;

export type ExtraRoute = {
  path: string;
  component: ComponentType;
};

export type DashboardConfig = {
  extraRoutes?: ExtraRoute[];
  slots?: SlotMap;
};

const ConfigContext = createContext<DashboardConfig>({});
export const ConfigProvider = ConfigContext.Provider;

export function useDashboardConfig() {
  return useContext(ConfigContext);
}

export function Slot<K extends SlotName>({ name, ctx }: { name: K; ctx?: unknown }) {
  const Comp = useContext(ConfigContext).slots?.[name] as
    | ComponentType<{ ctx?: unknown }>
    | undefined;
  return Comp ? <Comp ctx={ctx} /> : null;
}
