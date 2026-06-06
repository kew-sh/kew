import { api } from "@kew/core";
import { useQuery } from "@tanstack/react-query";

const ONE_HOUR = 60 * 60 * 1000;

export function useVersion() {
  return useQuery({
    queryKey: ["version"],
    queryFn: () => api.getVersion(),
    staleTime: ONE_HOUR,
    refetchInterval: ONE_HOUR,
    refetchOnWindowFocus: false,
  });
}
