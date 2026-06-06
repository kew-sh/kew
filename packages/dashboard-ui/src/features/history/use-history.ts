import { api, type HistoryQuery } from "@kew/core";
import { useQuery } from "@tanstack/react-query";

export function useHistory(query: HistoryQuery) {
  return useQuery({
    queryKey: [
      "history",
      query.queue ?? "",
      query.state ?? "",
      query.from ?? 0,
      query.to ?? 0,
      query.search ?? "",
      query.page,
      query.pageSize,
    ],
    queryFn: () => api.getHistory(query),
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
  });
}
