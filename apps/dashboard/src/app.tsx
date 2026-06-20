import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider } from "./components/theme";
import { Toaster, toast } from "./components/toast";
import type { AuthInfo } from "./lib/api";
import { router } from "./router";

function statusOf(error: unknown) {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

function reflectUnauthorized(error: unknown) {
  if (statusOf(error) === 401) {
    queryClient.setQueryData<AuthInfo>(["auth"], (prev) =>
      prev ? { ...prev, authenticated: false } : prev,
    );
  }
}

function notifyMutationError(error: unknown) {
  const status = statusOf(error);

  if (status === 401) return;

  const serverMessage = (error as { response?: { data?: { error?: string } } } | null)?.response
    ?.data?.error;

  toast.error(
    status === 403
      ? "This Kew instance is read-only — the action was blocked."
      : status === 429
        ? "Too many requests — wait a moment and try again."
        : (serverMessage ?? "Action failed. Check the connection and try again."),
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000, refetchOnWindowFocus: false },
  },
  queryCache: new QueryCache({ onError: reflectUnauthorized }),
  mutationCache: new MutationCache({
    onError: (error) => {
      reflectUnauthorized(error);
      notifyMutationError(error);
    },
  }),
});

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
