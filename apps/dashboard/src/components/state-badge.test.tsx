import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StateBadge, StateDot } from "./state-badge";

describe("StateBadge", () => {
  it("renders the human label for a state", () => {
    const { getByText } = render(<StateBadge state="active" />);
    expect(getByText("Active")).toBeInTheDocument();
  });

  it("renders the failed label and color token", () => {
    const { getByText } = render(<StateBadge state="failed" />);
    const label = getByText("Failed");
    expect(label).toHaveClass("text-failed");
    expect(label).toHaveClass("bg-failed/12");
  });

  it("forwards an extra className", () => {
    const { getByText } = render(<StateBadge state="completed" className="custom-x" />);
    expect(getByText("Completed")).toHaveClass("custom-x");
  });
});

describe("StateDot", () => {
  it("renders a colored dot for the state (no text)", () => {
    const { container } = render(<StateDot state="waiting" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("bg-waiting");
    expect(dot).toHaveClass("rounded-full");
    expect(dot.textContent).toBe("");
  });

  it("adds the pulse class when pulse is set", () => {
    const { container } = render(<StateDot state="active" pulse />);
    expect(container.firstChild).toHaveClass("pulse-dot");
  });

  it("omits the pulse class by default", () => {
    const { container } = render(<StateDot state="active" />);
    expect(container.firstChild).not.toHaveClass("pulse-dot");
  });
});
