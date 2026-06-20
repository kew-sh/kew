import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server, versionInfo } from "@/test/handlers";
import { renderHookWithClient } from "@/test/render";
import { useVersion } from "./use-version";

describe("useVersion", () => {
  it("returns the version info", async () => {
    server.use(
      http.get("*/api/version", () =>
        HttpResponse.json({ ...versionInfo, latest: "1.3.0", updateAvailable: true }),
      ),
    );

    const { result } = renderHookWithClient(() => useVersion());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.current).toBe("1.2.2");
    expect(result.current.data?.latest).toBe("1.3.0");
    expect(result.current.data?.updateAvailable).toBe(true);
  });
});
