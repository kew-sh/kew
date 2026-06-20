import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { connectionInfo, server } from "@/test/handlers";
import { renderHookWithClient } from "@/test/render";
import { useConnection } from "./use-connection";

describe("useConnection", () => {
  it("returns the connection info", async () => {
    server.use(
      http.get("*/api/connection", () =>
        HttpResponse.json({ ...connectionInfo, status: "connected", redisVersion: "7.4.0" }),
      ),
    );

    const { result } = renderHookWithClient(() => useConnection());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("connected");
    expect(result.current.data?.redisVersion).toBe("7.4.0");
  });
});
