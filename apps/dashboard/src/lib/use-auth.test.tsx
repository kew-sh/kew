import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import type { AuthInfo } from "@/lib/api";
import { authInfo, server } from "@/test/handlers";
import { renderHookWithClient } from "@/test/render";
import { useAuth, useLogin, useLogout } from "./use-auth";

describe("useAuth", () => {
  it("returns the current auth info", async () => {
    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json({ ...authInfo, authenticated: true, user: "alice" }),
      ),
    );

    const { result } = renderHookWithClient(() => useAuth());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.authenticated).toBe(true);
    expect(result.current.data?.user).toBe("alice");
  });
});

describe("useLogin", () => {
  it("posts the credentials", async () => {
    const box: { body?: unknown } = {};
    server.use(
      http.post("*/api/auth/login", async ({ request }) => {
        box.body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHookWithClient(() => useLogin());
    result.current.mutate({ email: "a@b.com", password: "pw" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(box.body).toEqual({ email: "a@b.com", password: "pw" });
  });
});

describe("useLogout", () => {
  it("posts to logout and marks the cached auth as unauthenticated", async () => {
    let called = false;
    server.use(
      http.post("*/api/auth/logout", () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result, client } = renderHookWithClient(() => useLogout());
    client.setQueryData<AuthInfo>(["auth"], {
      ...authInfo,
      authenticated: true,
      user: "alice",
    });

    await result.current.mutateAsync();

    expect(called).toBe(true);
    const cached = client.getQueryData<AuthInfo>(["auth"]);
    expect(cached?.authenticated).toBe(false);
    expect(cached?.user).toBeUndefined();
  });
});
