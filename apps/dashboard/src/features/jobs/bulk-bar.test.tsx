import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BulkBar } from "./bulk-bar";

describe("BulkBar", () => {
  it("renders nothing when no jobs are selected", () => {
    const { container } = render(
      <BulkBar count={0} pending={false} onAction={vi.fn()} onClear={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the selected count and the action buttons when count > 0", () => {
    render(<BulkBar count={3} pending={false} onAction={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /promote/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^remove$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear selection/i })).toBeInTheDocument();
  });

  it('calls onAction("retry") when Retry is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<BulkBar count={2} pending={false} onAction={onAction} onClear={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onAction).toHaveBeenCalledWith("retry");
  });

  it('calls onAction("promote") when Promote is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<BulkBar count={2} pending={false} onAction={onAction} onClear={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /promote/i }));
    expect(onAction).toHaveBeenCalledWith("promote");
  });

  it("calls onClear when the clear button is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<BulkBar count={2} pending={false} onAction={vi.fn()} onClear={onClear} />);
    await user.click(screen.getByRole("button", { name: /clear selection/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onAction("remove") after confirming the destructive dialog', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<BulkBar count={4} pending={false} onAction={onAction} onClear={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(onAction).not.toHaveBeenCalled();

    const confirm = await screen.findByRole("button", { name: /remove 4/i });
    await user.click(confirm);
    expect(onAction).toHaveBeenCalledWith("remove");
  });

  it("disables the actions while a bulk operation is pending", () => {
    render(<BulkBar count={2} pending={true} onAction={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /promote/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^remove$/i })).toBeDisabled();
  });
});
