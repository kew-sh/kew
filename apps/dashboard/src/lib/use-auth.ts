import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AuthInfo, api } from "@/lib/api";

export function useAuth() {
  return useQuery({
    queryKey: ["auth"],
    queryFn: () => api.getAuth(),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { email?: string; password: string }) => api.login(input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useLogout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      qc.setQueryData<AuthInfo>(["auth"], (prev) =>
        prev ? { ...prev, authenticated: false, user: undefined } : prev,
      );
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
    },
  });
}
