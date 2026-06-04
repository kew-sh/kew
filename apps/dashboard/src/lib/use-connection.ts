import { api } from "@kew/core";
import { useQuery } from "@tanstack/react-query";

export function useConnection() {
  return useQuery({
    queryKey: ["connection"],
    queryFn: () => api.getConnection(),
    refetchInterval: 5000,
    staleTime: 2000,
  });
}
