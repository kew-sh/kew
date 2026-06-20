import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useFlows() {
  return useQuery({
    queryKey: ["flows"],
    queryFn: () => api.listFlows(),
    refetchInterval: 4000,
  });
}
