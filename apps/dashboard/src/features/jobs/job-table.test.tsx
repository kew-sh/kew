import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkJob } from "@/test/handlers";
import { createWrapper } from "@/test/render";
import { JobTable } from "./job-table";

const ELEMENT_HEIGHT = 600;
const originals: {
  height?: PropertyDescriptor;
  width?: PropertyDescriptor;
  rect?: typeof Element.prototype.getBoundingClientRect;
} = {};

beforeAll(() => {
  originals.height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  originals.width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  originals.rect = Element.prototype.getBoundingClientRect;

  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return ELEMENT_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return 800;
    },
  });
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      width: 800,
      height: ELEMENT_HEIGHT,
      top: 0,
      left: 0,
      bottom: ELEMENT_HEIGHT,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

afterAll(() => {
  if (originals.height) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originals.height);
  }
  if (originals.width) {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originals.width);
  }
  if (originals.rect) {
    Element.prototype.getBoundingClientRect = originals.rect;
  }
});

function renderTable(props: Partial<Parameters<typeof JobTable>[0]> = {}) {
  const onOpenJob = vi.fn();
  const onSelectionChange = vi.fn();
  const jobs = props.jobs ?? [
    mkJob("1", { name: "send-welcome" }),
    mkJob("2", { name: "send-receipt", state: "failed" }),
  ];
  const { Wrapper } = createWrapper();
  const utils = render(
    <JobTable
      jobs={jobs}
      selection={{}}
      onSelectionChange={onSelectionChange}
      onOpenJob={onOpenJob}
      readOnly={false}
      {...props}
    />,
    { wrapper: Wrapper },
  );
  return { ...utils, onOpenJob, onSelectionChange, jobs };
}

describe("JobTable", () => {
  it("renders a row for each job, showing its name and id", () => {
    renderTable();

    expect(screen.getByText("send-welcome")).toBeInTheDocument();
    expect(screen.getByText("send-receipt")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("renders the column headers", () => {
    renderTable();
    expect(screen.getByText("Job")).toBeInTheDocument();
    expect(screen.getByText("State")).toBeInTheDocument();
  });

  it("calls onOpenJob with the job when a row is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenJob } = renderTable();

    const row = screen.getByRole("button", { name: /Open job send-welcome #1/ });
    await user.click(row);

    expect(onOpenJob).toHaveBeenCalledTimes(1);
    expect(onOpenJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", name: "send-welcome" }),
    );
  });

  it("clicking a row selection checkbox calls onSelectionChange (without opening the job)", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onOpenJob } = renderTable();

    const checkbox = screen.getByRole("checkbox", { name: "Select job 1" });
    await user.click(checkbox);

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onOpenJob).not.toHaveBeenCalled();
  });

  it("disables row selection for retained jobs", () => {
    renderTable({
      jobs: [mkJob("9", { name: "retained-job", retained: true })],
    });

    const checkbox = screen.getByRole("checkbox", { name: "Select job 9" });
    expect(checkbox).toBeDisabled();
    expect(screen.getByText("retained")).toBeInTheDocument();
  });

  it("renders a failedReason inline when present", () => {
    renderTable({
      jobs: [mkJob("3", { name: "broken", state: "failed", failedReason: "boom: timeout" })],
    });

    expect(screen.getByText("boom: timeout")).toBeInTheDocument();
  });

  it("does not render the per-row select checkbox as enabled when readOnly", () => {
    renderTable({ readOnly: true });

    const checkbox = screen.getByRole("checkbox", { name: "Select job 1" });
    expect(checkbox).toBeDisabled();
  });

  it("the row content includes the job state cell", () => {
    renderTable();
    const row = screen.getByRole("button", { name: /Open job send-receipt #2/ });
    expect(within(row).getByText(/failed/i)).toBeInTheDocument();
  });
});
