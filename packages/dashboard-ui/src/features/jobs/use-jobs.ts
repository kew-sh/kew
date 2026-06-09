import { api, type BulkAction, type JobQuery } from "@kew/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useJobs(query: JobQuery) {
  return useQuery({
    queryKey: ["jobs", query.queue, query.state, query.page, query.pageSize, query.search ?? ""],
    queryFn: () => api.getJobs(query),
    refetchInterval: 3000,
    placeholderData: (prev) => prev,
  });
}

function useInvalidateQueue(queue: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["jobs", queue] }),
      qc.invalidateQueries({ queryKey: ["queue", queue] }),
      qc.invalidateQueries({ queryKey: ["queues"] }),
    ]);
}

export function useBulkAction(queue: string) {
  const invalidate = useInvalidateQueue(queue);
  return useMutation({
    mutationFn: (input: { ids: string[]; action: BulkAction }) =>
      api.bulkAction({ queue, ...input }),
    onSuccess: invalidate,
  });
}

export function useJobAction(queue: string) {
  const invalidate = useInvalidateQueue(queue);
  return useMutation({
    mutationFn: (input: { id: string; action: BulkAction }) =>
      api.bulkAction({ queue, ids: [input.id], action: input.action }),
    onSuccess: invalidate,
  });
}

export function useRetryWithData(queue: string) {
  const invalidate = useInvalidateQueue(queue);
  return useMutation({
    mutationFn: (input: { id: string; data: unknown }) => api.retryWithData({ queue, ...input }),
    onSuccess: invalidate,
  });
}

export function useRerun(queue: string) {
  const invalidate = useInvalidateQueue(queue);
  return useMutation({
    mutationFn: (id: string) => api.rerun({ queue, id }),
    onSuccess: invalidate,
  });
}
