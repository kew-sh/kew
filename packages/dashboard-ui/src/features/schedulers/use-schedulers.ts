import { api, type SchedulerInput } from "@kew/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSchedulers(queue: string) {
  return useQuery({
    queryKey: ["schedulers", queue],
    queryFn: () => api.listSchedulers(queue),
    refetchInterval: 5000,
  });
}

export function useUpsertScheduler(queue: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SchedulerInput) => api.upsertScheduler(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulers", queue] }),
  });
}

export function useRemoveScheduler(queue: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.removeScheduler({ queue, id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulers", queue] }),
  });
}
