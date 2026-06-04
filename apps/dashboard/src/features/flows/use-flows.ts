import { api } from "@kew/core";
import { useQuery } from "@tanstack/react-query";

export function useFlows() {
  return useQuery({
    queryKey: ["flows"],
    queryFn: () => api.listFlows(),
    refetchInterval: 4000,
  });
}
