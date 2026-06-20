import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { Scheduler } from "@/lib/api";
import { scheduler, server } from "@/test/handlers";
import { createWrapper } from "@/test/render";
import { SchedulerDrawer } from "./scheduler-drawer";

function renderDrawer(sched: Scheduler | null, queue = "emails") {
  const onClose = vi.fn();
  const { Wrapper } = createWrapper();
  const utils = render(<SchedulerDrawer queue={queue} scheduler={sched} onClose={onClose} />, {
    wrapper: Wrapper,
  });
  return { ...utils, onClose };
}

describe("SchedulerDrawer", () => {
  it("renders the scheduler id, name, queue and the cron pattern when open", () => {
    renderDrawer({ ...scheduler, name: "report", id: "nightly", pattern: "0 0 * * *", tz: "UTC" });

    expect(screen.getAllByText("report").length).toBeGreaterThan(0);
    expect(screen.getByText("nightly")).toBeInTheDocument();
    expect(screen.getAllByText("emails").length).toBeGreaterThan(0);
    expect(screen.getByText("0 0 * * *")).toBeInTheDocument();
  });

  it("renders a human-readable schedule and upcoming runs", () => {
    renderDrawer({ ...scheduler, pattern: "0 9 * * *" });

    expect(screen.getByText(/At\b/i)).toBeInTheDocument();
    expect(screen.getByText(/Next runs/i)).toBeInTheDocument();
  });

  it("renders nothing visible when scheduler is null", () => {
    renderDrawer(null);
    expect(screen.queryByText(/Remove scheduler/i)).not.toBeInTheDocument();
  });

  it("removing the scheduler calls the delete endpoint and closes the drawer", async () => {
    let deletedPath: string | undefined;
    server.use(
      http.delete("*/api/queues/:queue/schedulers/:id", ({ request }) => {
        deletedPath = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    const { onClose } = renderDrawer({ ...scheduler, id: "nightly" }, "emails");

    await user.click(screen.getByRole("button", { name: /Remove scheduler/i }));
    const confirm = await screen.findByRole("button", { name: /^Remove$/ });
    await user.click(confirm);

    await waitFor(() => expect(deletedPath).toBe("/api/queues/emails/schedulers/nightly"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
