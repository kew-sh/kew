import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./index.css";

import type { AuthInfo } from "@kew/core";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme";
import { router } from "./router";

function reflectUnauthorized(error: unknown) {
  if ((error as { response?: { status?: number } } | null)?.response?.status === 401) {
    queryClient.setQueryData<AuthInfo>(["auth"], (prev) =>
      prev ? { ...prev, authenticated: false } : prev,
    );
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000, refetchOnWindowFocus: false },
  },
  queryCache: new QueryCache({ onError: reflectUnauthorized }),
  mutationCache: new MutationCache({ onError: reflectUnauthorized }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
