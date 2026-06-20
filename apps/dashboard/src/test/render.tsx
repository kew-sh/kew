import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function createWrapper() {
  const client = makeClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}

export function renderWithClient(ui: ReactElement) {
  const { Wrapper, client } = createWrapper();
  return { client, ...render(ui, { wrapper: Wrapper }) };
}

export function renderHookWithClient<T>(cb: () => T) {
  const { Wrapper, client } = createWrapper();
  return { client, ...renderHook(cb, { wrapper: Wrapper }) };
}
