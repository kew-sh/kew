import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

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

export function useSetQueuePaused() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { queue: string; paused: boolean }) => api.setQueuePaused(input),
    onSuccess: (_data, vars) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["queues"] }),
        qc.invalidateQueries({ queryKey: ["queue", vars.queue] }),
      ]),
  });
}
