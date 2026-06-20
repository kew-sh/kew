import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
