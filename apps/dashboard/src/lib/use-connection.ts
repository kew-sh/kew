import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useConnection() {
  return useQuery({
    queryKey: ["connection"],
    queryFn: () => api.getConnection(),
    refetchInterval: 5000,
    staleTime: 2000,
  });
}
