import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { JobQuery } from "./types";

/** Counts/health poll fast so the overview feels live (mirrors real polling). */
export function useQueues() {
  return useQuery({
    queryKey: ["queues"],
    queryFn: () => api.listQueues(),
    refetchInterval: 2000,
  });
}

export function useQueue(name: string) {
  return useQuery({
    queryKey: ["queue", name],
    queryFn: () => api.getQueue(name),
    refetchInterval: 2000,
  });
}

export function useConnection() {
  return useQuery({
    queryKey: ["connection"],
    queryFn: () => api.getConnection(),
    staleTime: 30_000,
  });
}

export function useJobs(query: JobQuery) {
  return useQuery({
    queryKey: ["jobs", query.queue, query.state, query.page, query.pageSize, query.search ?? ""],
    queryFn: () => api.getJobs(query),
    refetchInterval: 3000,
    placeholderData: (prev) => prev,
  });
}

export function useSchedulers(queue: string) {
  return useQuery({
    queryKey: ["schedulers", queue],
    queryFn: () => api.listSchedulers(queue),
    refetchInterval: 5000,
  });
}

export function useFlows() {
  return useQuery({
    queryKey: ["flows"],
    queryFn: () => api.listFlows(),
    refetchInterval: 4000,
  });
}
