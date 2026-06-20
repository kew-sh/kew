import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mkJob } from "@/test/handlers";
import { createWrapper } from "@/test/render";
import { JobDrawer } from "./job-drawer";

function renderDrawer(props: Partial<Parameters<typeof JobDrawer>[0]> = {}) {
  const onClose = vi.fn();
  const onAction = vi.fn();
  const onRetryWithData = vi.fn();
  const onRerun = vi.fn();
  const { Wrapper } = createWrapper();
  const utils = render(
    <JobDrawer
      job={props.job ?? mkJob("1", { name: "send-welcome" })}
      readOnly={props.readOnly ?? false}
      pending={props.pending ?? false}
      onClose={onClose}
      onAction={onAction}
      onRetryWithData={onRetryWithData}
      onRerun={onRerun}
      {...props}
    />,
    { wrapper: Wrapper },
  );
  return { ...utils, onClose, onAction, onRetryWithData, onRerun };
}

describe("JobDrawer", () => {
  it("shows the job id, name, queue and state when open", () => {
    renderDrawer({
      job: mkJob("42", { name: "send-welcome", queue: "emails", state: "completed" }),
    });

    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("send-welcome")).toBeInTheDocument();
    expect(screen.getByText("emails")).toBeInTheDocument();
    expect(screen.getAllByText(/completed/i).length).toBeGreaterThan(0);
  });

  it("shows the payload via JsonView", () => {
    renderDrawer({
      job: mkJob("7", { name: "job", data: { to: "user@example.com" } }),
    });
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
  });

  it("shows the failure reason for a failed job", () => {
    renderDrawer({
      job: mkJob("8", { name: "broken", state: "failed", failedReason: "exploded" }),
    });
    expect(screen.getByText("exploded")).toBeInTheDocument();
  });

  it("renders nothing visible when job is null", () => {
    renderDrawer({ job: null });
    expect(screen.queryByText("send-welcome")).not.toBeInTheDocument();
  });

  describe("editing a retained job (readOnly=false)", () => {
    const retained = () => mkJob("99", { name: "retained-job", retained: true, data: { x: 1 } });

    it("reveals a textarea when clicking Edit", async () => {
      const user = userEvent.setup();
      renderDrawer({ job: retained() });

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Edit/ }));

      const textarea = await screen.findByRole("textbox");
      expect(textarea).toBeInTheDocument();
      expect((textarea as HTMLTextAreaElement).value).toContain('"x": 1');
    });

    it("shows the Invalid JSON error and does not call onRerun for bad JSON", async () => {
      const user = userEvent.setup();
      const { onRerun } = renderDrawer({ job: retained() });

      await user.click(screen.getByRole("button", { name: /Edit/ }));
      const textarea = await screen.findByRole("textbox");

      await user.clear(textarea);
      await user.click(textarea);
      await user.paste("{ not json ");

      await user.click(screen.getByRole("button", { name: /Re-run with changes/ }));

      expect(await screen.findByText(/Invalid JSON/i)).toBeInTheDocument();
      expect(onRerun).not.toHaveBeenCalled();
    });

    it("calls onRerun with the parsed payload for valid JSON", async () => {
      const user = userEvent.setup();
      const { onRerun } = renderDrawer({ job: retained() });

      await user.click(screen.getByRole("button", { name: /Edit/ }));
      const textarea = await screen.findByRole("textbox");

      await user.clear(textarea);
      await user.click(textarea);
      await user.paste('{"y":2}');

      await user.click(screen.getByRole("button", { name: /Re-run with changes/ }));

      await waitFor(() => expect(onRerun).toHaveBeenCalledTimes(1));
      expect(onRerun).toHaveBeenCalledWith("99", { y: 2 });
    });
  });

  describe("editing a live (non-retained) failed job", () => {
    it("calls onRetryWithData with the parsed payload for valid JSON", async () => {
      const user = userEvent.setup();
      const { onRetryWithData } = renderDrawer({
        job: mkJob("12", { name: "failed-job", state: "failed", data: { a: 1 } }),
      });

      await user.click(screen.getByRole("button", { name: /^Edit/ }));
      const textarea = await screen.findByRole("textbox");

      await user.clear(textarea);
      await user.click(textarea);
      await user.paste('{"b":3}');

      await user.click(screen.getByRole("button", { name: /Retry with changes/ }));

      await waitFor(() => expect(onRetryWithData).toHaveBeenCalledTimes(1));
      expect(onRetryWithData).toHaveBeenCalledWith("12", { b: 3 });
    });
  });
});
